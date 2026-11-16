package com.erp.features.pos;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import com.erp.features.identity.api.ActorId;
import com.erp.features.identity.api.AuthenticatedActor;
import com.erp.features.inventory.api.InventoryMovements;
import com.erp.features.pos.api.SaleException;
import com.erp.features.pos.api.Sales;
import com.erp.features.pos.application.SaleStore;
import com.erp.features.tenancy.api.TenantId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

//SOLID: SRP — ESTA SUITE VERIFICA VENTAS E INVENTARIO EN UNA TRANSACCIÓN REAL.
@SpringBootTest(properties = {"AUTH_ISSUER_URI=https://issuer.example.test/", "AUTH_AUDIENCE=erp-api"})
@Testcontainers
class SaleIntegrationTest {
    private static final UUID ACTOR = UUID.fromString("aa000000-0000-4000-8000-000000000001");
    private static final UUID READER = UUID.fromString("bb000000-0000-4000-8000-000000000002");
    private static final TenantId A = new TenantId(UUID.fromString("cc000000-0000-4000-8000-000000000003"));
    private static final TenantId B = new TenantId(UUID.fromString("dd000000-0000-4000-8000-000000000004"));
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withInitScript("db/tenancy-test-roles.sql");
    @Autowired Sales sales;
    @Autowired InventoryMovements inventory;
    @Autowired JdbcTemplate jdbc;
    @MockBean AuthenticatedActor actor;
    @MockBean JwtDecoder decoder;
    @SpyBean SaleStore store;
    private final UUID product = UUID.randomUUID();

    @DynamicPropertySource static void properties(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", postgres::getJdbcUrl);
        p.add("spring.datasource.username", () -> "erp_runtime_login");
        p.add("spring.datasource.password", () -> "runtime-test-only");
        p.add("spring.flyway.url", postgres::getJdbcUrl);
        p.add("spring.flyway.user", () -> "erp_migrator");
        p.add("spring.flyway.password", () -> "migration-test-only");
    }
    @BeforeEach void provision() throws Exception {
        when(actor.actorId()).thenReturn(new ActorId(ACTOR));
        try (Connection db = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            for (TenantId tenant : List.of(A, B)) {
                execute(db, "insert into tenant(id,status,created_by,updated_by) values (?,'ACTIVE',?,?) on conflict do nothing",
                        tenant.value(), ACTOR, ACTOR);
                for (UUID user : List.of(ACTOR, READER)) {
                    UUID member = UUID.nameUUIDFromBytes((tenant.value().toString() + user).getBytes(java.nio.charset.StandardCharsets.UTF_8));
                    execute(db, "insert into tenant_membership(id,tenant_id,actor_id,status,created_by,updated_by) values (?,?,?,'ACTIVE',?,?) on conflict do nothing",
                            member, tenant.value(), user, ACTOR, ACTOR);
                    for (String permission : user.equals(ACTOR) ? List.of("read", "receive", "issue") : List.of("read")) {
                        execute(db, "insert into tenant_membership_permission(tenant_id,membership_id,permission_code) values (?,?,?) on conflict do nothing",
                                tenant.value(), member, "inventory:stock:" + permission);
                    }
                    if (user.equals(ACTOR)) {
                        execute(db, "insert into tenant_membership_permission(tenant_id,membership_id,permission_code) values (?,?,?) on conflict do nothing",
                                tenant.value(), member, "accounting:entry:create");
                    }
                }
            }
        }
    }
    @Test void successRetryConflictAndTenantIsolation() {
        receive(A, "10"); receive(B, "10");
        UUID id = UUID.randomUUID();
        Sales.Command command = command(id, "2", "4.10", "0.25");
        Sales.Sale first = sales.register(A, command);
        assertEquals(first, sales.register(A, command));
        assertEquals(new BigDecimal("8.20"), first.lines().get(0).netAmount());
        assertEquals(0, new BigDecimal("8").compareTo(inventory.availability(A, product).onHand()));
        assertEquals(SaleException.Code.IDEMPOTENCY_CONFLICT, assertThrows(SaleException.class,
                () -> sales.register(A, command(id, "2", "5.00", "0.25"))).code());
        assertEquals(0, new BigDecimal("8").compareTo(inventory.availability(A, product).onHand()));
        assertNotEquals(first.movementId(), sales.register(B, command).movementId());
        assertEquals(0, new BigDecimal("8").compareTo(inventory.availability(B, product).onHand()));
    }
    @Test void insufficientStockAndPermissionAreRejected() {
        receive(A, "1");
        UUID id = UUID.randomUUID();
        SaleException insufficient = assertThrows(SaleException.class,
                () -> sales.register(A, command(id, "2", "1.00", "0.00")));
        assertEquals(SaleException.Code.INSUFFICIENT_AVAILABILITY, insufficient.code());
        assertNull(insufficient.getCause());
        assertEquals(0, new BigDecimal("1").compareTo(inventory.availability(A, product).onHand()));
        when(actor.actorId()).thenReturn(new ActorId(READER));
        assertThrows(AccessDeniedException.class, () -> sales.register(A, command(id, "1", "1.00", "0.00")));
    }
    @Test void concurrentRetriesCreateOneSaleAndOneMovement() throws Exception {
        receive(A, "5");
        Sales.Command command = command(UUID.randomUUID(), "2", "1.00", "0.00");
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> { start.await(); return sales.register(A, command); });
            var second = executor.submit(() -> { start.await(); return sales.register(A, command); });
            start.countDown();
            assertEquals(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
        }
        assertEquals(0, new BigDecimal("3").compareTo(inventory.availability(A, product).onHand()));
    }
    @Test void retryPreservesQuantityRepresentationAfterDatabaseRoundTrip() {
        receive(A, "200");
        Sales.Command command = command(UUID.randomUUID(), "100.00", "1.00", "0.00");
        Sales.Sale first = sales.register(A, command);
        assertEquals(first, sales.register(A, command));
    }
    @Test void rowSecurityFailsClosedWithoutTenantContext() throws Exception {
        receive(A, "5");
        sales.register(A, command(UUID.randomUUID(), "2", "1.00", "0.00"));
        try (Connection runtime = DriverManager.getConnection(postgres.getJdbcUrl(), "erp_runtime_login", "runtime-test-only");
             PreparedStatement query = runtime.prepareStatement("select count(*) from pos_sale")) {
            try (var rows = query.executeQuery()) { rows.next(); assertEquals(0, rows.getInt(1)); }
        }
    }
    @Test void failureAfterSalePersistenceRollsBackSaleAndInventory() {
        receive(A, "5");
        UUID saleId = UUID.randomUUID();
        doAnswer(invocation -> { invocation.callRealMethod(); throw new IllegalStateException("rollback"); })
                .when(store).save(any(), any(), any(), any());
        var failure = assertThrows(org.springframework.dao.InvalidDataAccessApiUsageException.class,
                () -> sales.register(A, command(saleId, "2", "1.00", "0.00")));
        assertInstanceOf(IllegalStateException.class, failure.getCause());
        assertEquals(0, new BigDecimal("5").compareTo(inventory.availability(A, product).onHand()));
        try (Connection db = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             PreparedStatement q = db.prepareStatement("select count(*) from pos_sale where tenant_id=? and sale_id=?")) {
            q.setObject(1, A.value()); q.setObject(2, saleId);
            try (var rows = q.executeQuery()) { rows.next(); assertEquals(0, rows.getInt(1)); }
        } catch (java.sql.SQLException exception) { throw new AssertionError(exception); }
        reset(store);
        assertEquals(saleId, sales.register(A, command(saleId, "2", "1.00", "0.00")).saleId());
        assertEquals(0, new BigDecimal("3").compareTo(inventory.availability(A, product).onHand()));
    }
    private void receive(TenantId tenant, String amount) {
        inventory.receive(tenant, new InventoryMovements.StockCommand(UUID.randomUUID().toString(), "test",
                List.of(new InventoryMovements.Line(product, "unit", new BigDecimal(amount)))));
    }
    private Sales.Command command(UUID id, String quantity, String price, String tax) {
        return new Sales.Command(id, List.of(new Sales.Line(product, "unit", new BigDecimal(quantity),
                new BigDecimal(price), new BigDecimal(tax))));
    }
    private static void execute(Connection db, String query, Object... parameters) throws java.sql.SQLException {
        try (PreparedStatement q = db.prepareStatement(query)) {
            for (int index = 0; index < parameters.length; index++) { q.setObject(index + 1, parameters[index]); }
            q.executeUpdate();
        }
    }
}
