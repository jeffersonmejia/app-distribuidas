package com.erp.features.inventory;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.Mockito.when;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import com.erp.features.identity.api.ActorId;
import com.erp.features.identity.api.AuthenticatedActor;
import com.erp.features.inventory.api.InventoryMovements;
import com.erp.features.inventory.api.InventoryMovements.*;
import com.erp.features.inventory.domain.model.InventoryException;
import com.erp.features.tenancy.api.*;
import com.erp.features.tenancy.infrastructure.TenantAccessDeniedException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

//SOLID: SRP — ESTA SUITE VALIDA TRANSACCIONES, CONCURRENCIA Y RLS CON POSTGRESQL REAL.
@SpringBootTest(properties = {"AUTH_ISSUER_URI=https://issuer.example.test/", "AUTH_AUDIENCE=erp-api"})
@AutoConfigureMockMvc
@Testcontainers
class InventoryIntegrationTest {
    private static final UUID ACTOR = UUID.fromString("e1000000-0000-4000-8000-000000000001");
    private static final UUID READER = UUID.fromString("e2000000-0000-4000-8000-000000000002");
    private static final TenantId A = new TenantId(UUID.fromString("e3000000-0000-4000-8000-000000000003"));
    private static final TenantId B = new TenantId(UUID.fromString("e4000000-0000-4000-8000-000000000004"));
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withInitScript("db/tenancy-test-roles.sql");
    @Autowired InventoryMovements inventory;
    @Autowired TenantAccess access;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired com.erp.features.inventory.application.port.out.InventoryStore store;
    @MockBean JwtDecoder decoder;
    @MockBean AuthenticatedActor actor;
    private final UUID product = UUID.randomUUID();

    @DynamicPropertySource static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", postgres::getJdbcUrl);
        properties.add("spring.datasource.username", () -> "erp_runtime_login");
        properties.add("spring.datasource.password", () -> "runtime-test-only");
        properties.add("spring.flyway.url", postgres::getJdbcUrl);
        properties.add("spring.flyway.user", () -> "erp_migrator");
        properties.add("spring.flyway.password", () -> "migration-test-only");
    }

    @BeforeEach void provision() throws Exception {
        when(actor.actorId()).thenReturn(new ActorId(ACTOR));
        try (Connection db = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement statement = db.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS inventory_consumer_probe "
                    + "(id UUID PRIMARY KEY, tenant_id UUID NOT NULL, operation_id UUID NOT NULL)");
            statement.execute("GRANT SELECT, INSERT ON inventory_consumer_probe TO erp_runtime");
            for (TenantId tenant : List.of(A, B)) {
                try (PreparedStatement sql = db.prepareStatement(
                        "INSERT INTO tenant(id,status,created_by,updated_by) VALUES (?,'ACTIVE',?,?) ON CONFLICT DO NOTHING")) {
                    sql.setObject(1, tenant.value()); sql.setObject(2, ACTOR); sql.setObject(3, ACTOR); sql.executeUpdate();
                }
                for (UUID user : List.of(ACTOR, READER)) {
                    UUID member;
                    try (PreparedStatement sql = db.prepareStatement("""
                            INSERT INTO tenant_membership(id,tenant_id,actor_id,status,created_by,updated_by)
                            VALUES (?,?,?,'ACTIVE',?,?) ON CONFLICT (tenant_id,actor_id)
                            DO UPDATE SET status='ACTIVE' RETURNING id
                            """)) {
                        sql.setObject(1, UUID.randomUUID()); sql.setObject(2, tenant.value()); sql.setObject(3, user);
                        sql.setObject(4, ACTOR); sql.setObject(5, ACTOR);
                        try (var rows = sql.executeQuery()) { rows.next(); member = rows.getObject(1, UUID.class); }
                    }
                    for (String action : user.equals(READER) ? List.of("read")
                            : List.of("read", "receive", "issue", "reserve", "confirm", "release")) {
                        try (PreparedStatement sql = db.prepareStatement("""
                                INSERT INTO tenant_membership_permission(tenant_id,membership_id,permission_code)
                                VALUES (?,?,?) ON CONFLICT DO NOTHING
                                """)) {
                            sql.setObject(1, tenant.value()); sql.setObject(2, member);
                            sql.setString(3, "inventory:stock:" + action); sql.executeUpdate();
                        }
                    }
                    if (user.equals(ACTOR)) {
                        for (String permission : List.of("inventory:catalog:read", "inventory:catalog:manage")) {
                            try (PreparedStatement sql = db.prepareStatement("""
                                    INSERT INTO tenant_membership_permission(tenant_id,membership_id,permission_code)
                                    VALUES (?,?,?) ON CONFLICT DO NOTHING
                                    """)) {
                                sql.setObject(1, tenant.value()); sql.setObject(2, member); sql.setString(3, permission);
                                sql.executeUpdate();
                            }
                        }
                    }
                }
            }
        }
    }

    @Test void productCatalogHttpRoutesPersistTenantScopedProductsAndMetrics() throws Exception {
        String path = "/api/v1/inventory/products";
        String create = """
                {"name":"Widget","sku":"W-001","category":"Equipos","description":"Prueba","unit":"unidad",
                 "purchasePrice":"2.50","sellingPrice":"3.50","minStock":"2","initialStock":"4"}
                """;
        String response = mvc.perform(post(path).with(jwt().jwt(token -> token.subject(ACTOR.toString())))
                        .header("X-Tenant-ID", A.value()).contentType(MediaType.APPLICATION_JSON).content(create))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.sku").value("W-001"))
                .andExpect(jsonPath("$.stock").value("4")).andReturn().getResponse().getContentAsString();
        UUID id = UUID.fromString(new com.fasterxml.jackson.databind.ObjectMapper().readTree(response).get("id").asText());

        mvc.perform(get(path).with(jwt().jwt(token -> token.subject(ACTOR.toString())))
                        .header("X-Tenant-ID", A.value()).param("search", "W-001"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(id.toString()));
        mvc.perform(get(path + "/" + id).with(jwt().jwt(token -> token.subject(ACTOR.toString())))
                        .header("X-Tenant-ID", A.value()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.unit").value("unidad"));
        mvc.perform(put(path + "/" + id).with(jwt().jwt(token -> token.subject(ACTOR.toString())))
                        .header("X-Tenant-ID", A.value()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Widget editado\",\"sku\":\"W-001\",\"category\":\"Equipos\",\"unit\":\"unidad\",\"purchasePrice\":\"2.50\",\"sellingPrice\":\"3.50\",\"minStock\":\"2\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Widget editado"));
        mvc.perform(get(path + "/" + id + "/availability").with(jwt().jwt(token -> token.subject(ACTOR.toString())))
                        .header("X-Tenant-ID", A.value()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.available").value("4"));
        mvc.perform(get(path + "/metrics").with(jwt().jwt(token -> token.subject(ACTOR.toString())))
                        .header("X-Tenant-ID", A.value()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalProducts").value(1));
        mvc.perform(post(path).with(jwt().jwt(token -> token.subject(ACTOR.toString())))
                        .header("X-Tenant-ID", A.value()).contentType(MediaType.APPLICATION_JSON).content(create))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SKU_ALREADY_EXISTS"));
        mvc.perform(get(path + "/" + id).with(jwt().jwt(token -> token.subject(ACTOR.toString())))
                        .header("X-Tenant-ID", B.value()))
                .andExpect(status().isNotFound());
        mvc.perform(get(path).with(jwt().jwt(token -> token.subject(ACTOR.toString())))
                        .header("X-Tenant-ID", A.value()).param("size", "6"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test void receiptReservationConfirmationAndRetryHaveOneEffect() {
        StockCommand receive = command("receive", "10.25");
        Operation first = inventory.receive(A, receive);
        assertEquals(first, inventory.receive(A, receive));
        Operation reserved = inventory.reserve(A, command("reserve", "3.25"));
        assertDecimal("7", inventory.availability(A, product).available());
        ReservationCommand command = new ReservationCommand(key("confirm"), "sale", reserved.id());
        Operation confirmed = inventory.confirmReservation(A, command);
        assertEquals(confirmed, inventory.confirmReservation(A, command));
        assertDecimal("7", inventory.availability(A, product).onHand());
        assertDecimal("0", inventory.availability(A, product).reserved());
        Reservation view = inventory.reservation(A, reserved.id());
        assertEquals(Status.CONFIRMED, view.status()); assertEquals(confirmed.id(), view.confirmationId());
        assertThrows(InventoryException.class, () -> inventory.receive(A, new StockCommand(
                receive.operationKey(), "sale", List.of(line(product, "11")))));
    }

    @Test void releaseAndUnitChecksProtectPhysicalBalance() {
        inventory.receive(A, command("receive", "5"));
        Operation reserved = inventory.reserve(A, command("reserve", "4"));
        assertThrows(InventoryException.class, () -> inventory.issue(A, command("too-much", "2")));
        ReservationCommand release = new ReservationCommand(key("release"), "sale", reserved.id());
        assertEquals(inventory.releaseReservation(A, release), inventory.releaseReservation(A, release));
        assertDecimal("5", inventory.availability(A, product).onHand());
        assertDecimal("5", inventory.availability(A, product).available());
        assertEquals(Status.RELEASED, inventory.reservation(A, reserved.id()).status());
        assertThrows(InventoryException.class, () -> inventory.receive(A, new StockCommand(key("units"), "sale",
                List.of(new Line(product, "different-unit", BigDecimal.ONE)))));
    }

    @Test void consumerFailureRollsBackStockOperationAndSameDatabaseWork() {
        inventory.receive(A, command("receive", "5"));
        StockCommand issue = command("issue", "2");
        UUID sale = UUID.randomUUID();
        assertThrows(IllegalStateException.class, () -> inventory.issueAndExecute(A, issue, movement -> {
            jdbc.update("INSERT INTO inventory_consumer_probe VALUES (?,?,?)", sale, A.value(), movement.id());
            throw new IllegalStateException("simulate consumer failure");
        }));
        assertDecimal("5", inventory.availability(A, product).onHand());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM inventory_consumer_probe WHERE id=?", Integer.class, sale));
        Operation result = inventory.issueAndExecute(A, issue, movement -> {
            jdbc.update("INSERT INTO inventory_consumer_probe VALUES (?,?,?)", sale, A.value(), movement.id());
            assertEquals(A.value().toString(), jdbc.queryForObject(
                    "select current_setting('app.tenant_id', true)", String.class));
            return movement;
        });
        assertDecimal("3", inventory.availability(A, product).onHand());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM inventory_consumer_probe WHERE id=?", Integer.class, sale));
        assertEquals(result, inventory.issue(A, issue));
    }

    @Test void failedConfirmationRollsBackReservationAndCanBeRetried() {
        inventory.receive(A, command("receive", "5"));
        Operation reserve = inventory.reserve(A, command("reserve", "3"));
        ReservationCommand confirm = new ReservationCommand(key("confirm"), "sale", reserve.id());
        assertThrows(IllegalStateException.class, () -> inventory.confirmAndExecute(A, confirm, movement -> {
            throw new IllegalStateException("sale failed");
        }));
        assertEquals(Status.ACTIVE, inventory.reservation(A, reserve.id()).status());
        assertDecimal("5", inventory.availability(A, product).onHand());
        assertDecimal("3", inventory.availability(A, product).reserved());
        inventory.confirmReservation(A, confirm);
        assertDecimal("2", inventory.availability(A, product).onHand());
    }

    @Test void multiLineFailureLeavesNoPartialStockOrMovement() {
        inventory.receive(A, command("receive", "5"));
        StockCommand invalid = new StockCommand(key("bad"), "sale",
                List.of(line(product, "1"), line(UUID.randomUUID(), "1")));
        assertThrows(InventoryException.class, () -> inventory.issue(A, invalid));
        assertDecimal("5", inventory.availability(A, product).onHand());
        int count = access.execute(A, "inventory:stock:read", context -> jdbc.queryForObject(
                "SELECT count(*) FROM inventory_operation WHERE tenant_id=? AND operation_key=?",
                Integer.class, A.value(), invalid.operationKey()));
        assertEquals(0, count);
    }

    @Test void concurrentRetriesAndReservationsDoNotDuplicateOrOversell() throws Exception {
        StockCommand receipt = command("receive", "10");
        List<Operation> receipts = parallel(() -> inventory.receive(A, receipt), () -> inventory.receive(A, receipt));
        assertEquals(receipts.get(0).id(), receipts.get(1).id());
        assertDecimal("10", inventory.availability(A, product).onHand());
        List<Boolean> outcomes = parallel(
                () -> tryReserve(command("r1", "7")), () -> tryReserve(command("r2", "7")));
        assertEquals(1, outcomes.stream().filter(Boolean::booleanValue).count());
        assertDecimal("7", inventory.availability(A, product).reserved());
    }

    @Test void concurrentConfirmAndReleaseHaveOnlyOneTerminalEffect() throws Exception {
        inventory.receive(A, command("receive", "10"));
        Operation reserve = inventory.reserve(A, command("reserve", "4"));
        List<Boolean> outcomes = parallel(
                () -> transition(new ReservationCommand(key("c"), "sale", reserve.id()), true),
                () -> transition(new ReservationCommand(key("l"), "sale", reserve.id()), false));
        assertEquals(1, outcomes.stream().filter(Boolean::booleanValue).count());
        Availability stock = inventory.availability(A, product);
        assertDecimal("0", stock.reserved());
        Status status = inventory.reservation(A, reserve.id()).status();
        assertDecimal(status == Status.CONFIRMED ? "6" : "10", stock.onHand());
    }

    @Test void realMembershipDeniesWritesAndTenantReferencesDoNotLeak() {
        inventory.receive(A, command("receive", "3"));
        assertThrows(InventoryException.class, () -> inventory.availability(B, product));
        Operation reserve = inventory.reserve(A, command("reserve", "1"));
        assertThrows(InventoryException.class, () -> inventory.reservation(B, reserve.id()));
        when(actor.actorId()).thenReturn(new ActorId(READER));
        assertDecimal("3", inventory.availability(A, product).onHand());
        assertThrows(TenantAccessDeniedException.class, () -> inventory.receive(A, command("denied", "1")));
        when(actor.actorId()).thenReturn(new ActorId(UUID.randomUUID()));
        assertThrows(TenantAccessDeniedException.class, () -> inventory.availability(A, product));
    }

    @Test void runtimeRlsFailsClosedAndConstraintsRejectCrossTenantAndInvalidBalances() {
        Operation movement = inventory.receive(A, command("receive", "3"));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM inventory_stock", Integer.class));
        assertFalse(jdbc.queryForObject(
                "SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user", Boolean.class));
        assertFalse(jdbc.queryForObject("""
                SELECT pg_get_userbyid(relowner)=current_user
                FROM pg_class WHERE relname='inventory_stock'
                """, Boolean.class));
        access.execute(B, "inventory:stock:read", context -> {
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM inventory_stock WHERE product_id=?", Integer.class, product));
            return null;
        });
        assertThrows(DataAccessException.class, () -> access.execute(A, "inventory:stock:receive", context -> {
            jdbc.update("UPDATE inventory_stock SET on_hand=-1 WHERE tenant_id=? AND product_id=?", A.value(), product);
            return null;
        }));
        assertThrows(DataAccessException.class, () -> access.execute(A, "inventory:stock:receive", context -> {
            jdbc.update("UPDATE inventory_stock SET reserved=4 WHERE tenant_id=? AND product_id=?", A.value(), product);
            return null;
        }));
        assertThrows(DataAccessException.class, () -> access.execute(B, "inventory:stock:receive", context -> {
            jdbc.update("""
                    INSERT INTO inventory_operation_line(id,tenant_id,operation_id,product_id,line_number,unit,quantity)
                    VALUES (?,?,?,?,0,'u',1)
                    """, UUID.randomUUID(), B.value(), movement.id(), product);
            return null;
        }));
        assertThrows(DataAccessException.class, () -> access.execute(B, "inventory:stock:receive", context -> {
            jdbc.update("""
                    INSERT INTO inventory_operation_line(id,tenant_id,operation_id,product_id,line_number,unit,quantity)
                    VALUES (?,?,?,?,0,'u',1)
                    """, UUID.randomUUID(), A.value(), movement.id(), product);
            return null;
        }));
        assertThrows(DataAccessException.class, () -> access.execute(A, "inventory:stock:receive", context -> {
            jdbc.update("UPDATE inventory_operation SET source_reference='tampered' WHERE tenant_id=? AND id=?",
                    A.value(), movement.id()); return null;
        }));
        assertThrows(DataAccessException.class, () -> access.execute(A, "inventory:stock:receive", context -> {
            jdbc.update("DELETE FROM inventory_operation WHERE tenant_id=? AND id=?", A.value(), movement.id()); return null;
        }));
        assertDecimal("3", inventory.availability(A, product).onHand());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM inventory_stock", Integer.class));
    }

    @Test void persistenceLockRequiresTheMatchingAuthorizedTransaction() {
        assertThrows(RuntimeException.class, () -> store.lockTenant(A.value()));
        assertThrows(RuntimeException.class, () -> access.execute(A, "inventory:stock:read", context -> {
            store.lockTenant(B.value()); return null;
        }));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM inventory_stock", Integer.class));
    }

    private boolean tryReserve(StockCommand command) {
        try { inventory.reserve(A, command); return true; }
        catch (InventoryException exception) {
            assertEquals(InventoryException.Code.INSUFFICIENT_AVAILABILITY, exception.code()); return false;
        }
    }
    private boolean transition(ReservationCommand command, boolean confirm) {
        try {
            if (confirm) { inventory.confirmReservation(A, command); } else { inventory.releaseReservation(A, command); }
            return true;
        } catch (InventoryException exception) {
            assertEquals(InventoryException.Code.RESERVATION_STATE_CONFLICT, exception.code()); return false;
        }
    }

    @SafeVarargs private static <T> List<T> parallel(Callable<T>... jobs) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(jobs.length);
        CountDownLatch ready = new CountDownLatch(jobs.length);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<T>> futures = new ArrayList<>();
            for (Callable<T> job : jobs) {
                futures.add(executor.submit(() -> {
                    ready.countDown(); assertTrue(start.await(15, TimeUnit.SECONDS)); return job.call();
                }));
            }
            assertTrue(ready.await(15, TimeUnit.SECONDS)); start.countDown();
            List<T> result = new ArrayList<>();
            for (Future<T> future : futures) { result.add(future.get(30, TimeUnit.SECONDS)); }
            return result;
        } finally { executor.shutdownNow(); }
    }

    private StockCommand command(String key, String quantity) {
        return new StockCommand(key(key), "sale", List.of(line(product, quantity)));
    }
    private String key(String name) { return product + "/" + name; }
    private static Line line(UUID product, String quantity) { return new Line(product, "u", new BigDecimal(quantity)); }
    private static void assertDecimal(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual));
    }
}

