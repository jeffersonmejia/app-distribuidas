package com.erp.features.accounting;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.erp.features.accounting.api.AccountingEntries;
import com.erp.features.accounting.api.AccountingException;
import com.erp.features.accounting.application.AccountingStore;
import com.erp.features.identity.api.ActorId;
import com.erp.features.identity.api.AuthenticatedActor;
import com.erp.features.inventory.api.InventoryMovements;
import com.erp.features.pos.api.Sales;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

//SOLID: SRP — ESTA SUITE VERIFICA ASIENTOS Y VENTAS EN POSTGRESQL REAL.
@SpringBootTest(properties = {"AUTH_ISSUER_URI=https://issuer.example.test/", "AUTH_AUDIENCE=erp-api"})
@AutoConfigureMockMvc
@Testcontainers
class AccountingIntegrationTest {
    private static final UUID ACTOR = UUID.fromString("ab000000-0000-4000-8000-000000000001");
    private static final UUID NO_ACCOUNTING = UUID.fromString("bb000000-0000-4000-8000-000000000002");
    private static final TenantId A = new TenantId(UUID.fromString("cd000000-0000-4000-8000-000000000003"));
    private static final TenantId B = new TenantId(UUID.fromString("de000000-0000-4000-8000-000000000004"));
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withInitScript("db/tenancy-test-roles.sql");
    @Autowired Sales sales;
    @Autowired InventoryMovements inventory;
    @Autowired AccountingEntries accounting;
    @Autowired TenantAccess access;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @SpyBean AccountingStore store;
    @MockBean AuthenticatedActor actor;
    @MockBean JwtDecoder decoder;
    private final UUID product = UUID.randomUUID();

    @DynamicPropertySource static void properties(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url", postgres::getJdbcUrl);
        p.add("spring.datasource.username", () -> "erp_runtime_login");
        p.add("spring.datasource.password", () -> "runtime-test-only");
        p.add("spring.flyway.url", postgres::getJdbcUrl);
        p.add("spring.flyway.user", () -> "erp_migrator");
        p.add("spring.flyway.password", () -> "migration-test-only");
    }
    @BeforeEach void seed() throws Exception {
        when(actor.actorId()).thenReturn(new ActorId(ACTOR));
        try (Connection db = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            for (TenantId tenant : List.of(A, B)) {
                execute(db, "insert into tenant(id,status,created_by,updated_by) values (?,'ACTIVE',?,?) on conflict do nothing",
                        tenant.value(), ACTOR, ACTOR);
                for (UUID user : List.of(ACTOR, NO_ACCOUNTING)) {
                    UUID member = UUID.nameUUIDFromBytes((tenant.value().toString() + user).getBytes(java.nio.charset.StandardCharsets.UTF_8));
                    execute(db, "insert into tenant_membership(id,tenant_id,actor_id,status,created_by,updated_by) values (?,?,?,'ACTIVE',?,?) on conflict do nothing",
                            member, tenant.value(), user, ACTOR, ACTOR);
                    for (String permission : List.of("inventory:stock:read", "inventory:stock:receive", "inventory:stock:issue")) {
                        execute(db, "insert into tenant_membership_permission(tenant_id,membership_id,permission_code) values (?,?,?) on conflict do nothing",
                                tenant.value(), member, permission);
                    }
                    if (user.equals(ACTOR)) {
                        for (String permission : List.of("accounting:entry:create", "accounting:entry:reverse", "accounting:entry:read")) {
                            execute(db, "insert into tenant_membership_permission(tenant_id,membership_id,permission_code) values (?,?,?) on conflict do nothing",
                                    tenant.value(), member, permission);
                        }
                    }
                }
            }
        }
    }

    @Test void persistedAccountingEntriesAreAvailableThroughTenantScopedReadApi() throws Exception {
        long initialEntries = accounting.summary(A).totalEntries();
        receive(A, "5");
        UUID saleId = UUID.randomUUID();
        sales.register(A, command(saleId, "2", "4.10", "0.25"));
        String path = "/api/v1/accounting/entries";
        String result = mvc.perform(get(path).with(jwt().jwt(token -> token.subject(ACTOR.toString())))
                        .header("X-Tenant-ID", A.value()).param("search", saleId.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].saleId").value(saleId.toString()))
                .andReturn().getResponse().getContentAsString();
        UUID entryId = UUID.fromString(new com.fasterxml.jackson.databind.ObjectMapper().readTree(result)
                .get("items").get(0).get("id").asText());
        mvc.perform(get(path + "/" + entryId).with(jwt().jwt(token -> token.subject(ACTOR.toString())))
                        .header("X-Tenant-ID", A.value()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.movements.length()").value(3));
        mvc.perform(get(path + "/summary").with(jwt().jwt(token -> token.subject(ACTOR.toString())))
                        .header("X-Tenant-ID", A.value()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalEntries").value(initialEntries + 1));
        mvc.perform(get(path + "/" + UUID.randomUUID()).with(jwt().jwt(token -> token.subject(ACTOR.toString())))
                        .header("X-Tenant-ID", A.value()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("JOURNAL_NOT_FOUND"));
        mvc.perform(get(path).with(jwt().jwt(token -> token.subject(ACTOR.toString())))
                        .header("X-Tenant-ID", A.value()).param("size", "6"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }
    @Test void saleIsRecordedOnceAndReversalIsTotalAndIdempotent() {
        receive(A, "5");
        UUID saleId = UUID.randomUUID();
        Sales.Command command = command(saleId, "2", "4.10", "0.25");
        assertEquals(sales.register(A, command), sales.register(A, command));
        UUID reversalId = UUID.randomUUID();
        AccountingEntries.Entry reversal = accounting.reverse(A, new AccountingEntries.ReversalCommand(saleId, reversalId));
        assertEquals(reversal, accounting.reverse(A, new AccountingEntries.ReversalCommand(saleId, reversalId)));
        assertEquals("CREDIT", reversal.movements().get(0).side());
        assertEquals(0, new BigDecimal("8.45").compareTo(reversal.movements().get(0).amount()));
        assertEquals("DEBIT", reversal.movements().get(1).side());
        assertEquals(0, new BigDecimal("8.20").compareTo(reversal.movements().get(1).amount()));
        assertEquals(0, new BigDecimal("0.25").compareTo(reversal.movements().get(2).amount()));
        assertEquals(AccountingException.Code.ALREADY_REVERSED, assertThrows(AccountingException.class,
                () -> accounting.reverse(A, new AccountingEntries.ReversalCommand(saleId, UUID.randomUUID()))).code());
        assertEquals(AccountingException.Code.IDEMPOTENCY_CONFLICT, assertThrows(AccountingException.class,
                () -> accounting.reverse(A, new AccountingEntries.ReversalCommand(UUID.randomUUID(), reversalId))).code());
        assertEquals(AccountingException.Code.SALE_NOT_FOUND, assertThrows(AccountingException.class,
                () -> accounting.reverse(B, new AccountingEntries.ReversalCommand(saleId, UUID.randomUUID()))).code());
    }
    @Test void missingAccountingPermissionRollsBackSaleAndStock() {
        receive(A, "5");
        when(actor.actorId()).thenReturn(new ActorId(NO_ACCOUNTING));
        UUID saleId = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () -> sales.register(A, command(saleId, "2", "1.00", "0.00")));
        assertEquals(0, new BigDecimal("5").compareTo(inventory.availability(A, product).onHand()));
        assertEquals(0, countSale(saleId, "pos_sale"));
        assertEquals(0, countSale(saleId, "accounting_journal"));
        assertThrows(AccessDeniedException.class,
                () -> accounting.reverse(A, new AccountingEntries.ReversalCommand(saleId, UUID.randomUUID())));
    }
    @Test void failureAfterAccountingInsertRollsBackEverything() {
        receive(A, "5");
        UUID saleId = UUID.randomUUID();
        doAnswer(invocation -> { invocation.callRealMethod(); throw new IllegalStateException("rollback"); })
                .when(store).save(any(), any(), eq(false), any(), any());
        assertThrows(RuntimeException.class, () -> sales.register(A, command(saleId, "2", "1.00", "0.00")));
        assertEquals(0, new BigDecimal("5").compareTo(inventory.availability(A, product).onHand()));
        assertEquals(0, countSale(saleId, "pos_sale"));
        assertEquals(0, countSale(saleId, "accounting_journal"));
    }
    @Test void joinedAuthorizationRequiresMatchingContextAndRestoresPermission() {
        assertThrows(IllegalArgumentException.class,
                () -> access.executeJoined(A, "accounting:entry:create", ignored -> null));
        access.execute(A, "inventory:stock:issue", context -> {
            access.executeJoined(A, "accounting:entry:create", ignored -> {
                assertEquals("accounting:entry:create",
                        jdbc.queryForObject("select current_setting('app.permission')", String.class));
                return null;
            });
            assertEquals("inventory:stock:issue",
                    jdbc.queryForObject("select current_setting('app.permission')", String.class));
            return null;
        });
        assertThrows(AccessDeniedException.class, () -> access.execute(A, "inventory:stock:issue",
                context -> access.executeJoined(B, "accounting:entry:create", ignored -> null)));
        RuntimeException databaseFailure = assertThrows(RuntimeException.class,
                () -> access.execute(A, "inventory:stock:issue", context ->
                        access.executeJoined(A, "accounting:entry:create", ignored ->
                                jdbc.queryForObject("select 1 / 0", Integer.class))));
        assertNotNull(databaseFailure.getCause());
        assertTrue(databaseFailure.getCause() instanceof java.sql.SQLException);
        assertEquals("22012", ((java.sql.SQLException) databaseFailure.getCause()).getSQLState());
    }
    @Test void duplicateSaleWithDifferentAmountsConflictsAndTenantRowsStayIsolated() throws Exception {
        receive(A, "5"); receive(B, "5");
        UUID saleId = UUID.randomUUID();
        Sales.Command command = command(saleId, "2", "1.00", "0.10");
        sales.register(A, command);
        AccountingException conflict = assertThrows(AccountingException.class, () -> access.execute(A,
                "inventory:stock:issue", ignored -> accounting.recordSale(A,
                        new AccountingEntries.SaleCommand(saleId, new BigDecimal("2.20"), List.of(new BigDecimal("0.20"))))));
        assertEquals(AccountingException.Code.IDEMPOTENCY_CONFLICT, conflict.code());
        sales.register(B, command);
        assertEquals(1, countSale(saleId, "accounting_journal"));
        try (Connection runtime = DriverManager.getConnection(postgres.getJdbcUrl(), "erp_runtime_login", "runtime-test-only");
             PreparedStatement query = runtime.prepareStatement("select count(*) from accounting_journal")) {
            try (var rows = query.executeQuery()) { rows.next(); assertEquals(0, rows.getInt(1)); }
        }
    }
    @Test void failedReversalRollsBackAndCanBeRetried() {
        receive(A, "5");
        UUID saleId = UUID.randomUUID();
        sales.register(A, command(saleId, "2", "1.00", "0.10"));
        UUID reversalId = UUID.randomUUID();
        doAnswer(invocation -> { invocation.callRealMethod(); throw new IllegalStateException("rollback"); })
                .when(store).save(any(), any(), eq(true), any(), any());
        assertThrows(RuntimeException.class,
                () -> accounting.reverse(A, new AccountingEntries.ReversalCommand(saleId, reversalId)));
        assertEquals(1, countSale(saleId, "accounting_journal"));
        reset(store);
        assertEquals(reversalId, accounting.reverse(A, new AccountingEntries.ReversalCommand(saleId, reversalId)).reversalId());
        assertEquals(2, countSale(saleId, "accounting_journal"));
    }
    @Test void concurrentReversalRequestsProduceOneReversal() throws Exception {
        receive(A, "5");
        UUID saleId = UUID.randomUUID();
        sales.register(A, command(saleId, "2", "1.00", "0.10"));
        UUID reversalId = UUID.randomUUID();
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> { start.await(); return accounting.reverse(A, new AccountingEntries.ReversalCommand(saleId, reversalId)); });
            var second = executor.submit(() -> { start.await(); return accounting.reverse(A, new AccountingEntries.ReversalCommand(saleId, reversalId)); });
            start.countDown();
            assertEquals(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
        }
        assertEquals(2, countSale(saleId, "accounting_journal"));
    }
    @Test void databaseRejectsUnbalancedJournalEvenWithTenantContext() throws Exception {
        try (Connection runtime = DriverManager.getConnection(postgres.getJdbcUrl(), "erp_runtime_login", "runtime-test-only")) {
            runtime.setAutoCommit(false);
            try (PreparedStatement context = runtime.prepareStatement("select set_config('app.tenant_id', ?, true)")) {
                context.setString(1, A.value().toString()); context.execute();
            }
            execute(runtime, """
                    insert into accounting_journal(id,tenant_id,sale_id,kind,fingerprint,created_at,updated_at,created_by,updated_by)
                    values (?,?,?,'SALE','test',now(),now(),?,?)
                    """, UUID.randomUUID(), A.value(), UUID.randomUUID(), ACTOR, ACTOR);
            java.sql.SQLException error = assertThrows(java.sql.SQLException.class, runtime::commit);
            assertEquals("23514", error.getSQLState());
            runtime.rollback();
        }
    }
    @Test void runtimeCannotInsertJournalForAnotherTenant() throws Exception {
        try (Connection runtime = DriverManager.getConnection(postgres.getJdbcUrl(), "erp_runtime_login", "runtime-test-only")) {
            runtime.setAutoCommit(false);
            try (PreparedStatement context = runtime.prepareStatement("select set_config('app.tenant_id', ?, true)")) {
                context.setString(1, A.value().toString()); context.execute();
            }
            java.sql.SQLException error = assertThrows(java.sql.SQLException.class, () -> execute(runtime, """
                    insert into accounting_journal(id,tenant_id,sale_id,kind,fingerprint,created_at,updated_at,created_by,updated_by)
                    values (?,?,?,'SALE','test',now(),now(),?,?)
                    """, UUID.randomUUID(), B.value(), UUID.randomUUID(), ACTOR, ACTOR));
            assertEquals("42501", error.getSQLState());
            runtime.rollback();
        }
    }
    @Test void databaseRejectsReversalReferencingItselfOrAnotherSale() throws Exception {
        receive(A, "5");
        UUID firstSale = UUID.randomUUID();
        UUID otherSale = UUID.randomUUID();
        sales.register(A, command(firstSale, "1", "1.00", "0.00"));
        sales.register(A, command(otherSale, "1", "1.00", "0.00"));
        UUID original;
        try (Connection admin = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             PreparedStatement q = admin.prepareStatement("select id from accounting_journal where tenant_id=? and sale_id=?")) {
            q.setObject(1, A.value()); q.setObject(2, otherSale);
            try (var rows = q.executeQuery()) { rows.next(); original = rows.getObject(1, UUID.class); }
        }
        try (Connection runtime = DriverManager.getConnection(postgres.getJdbcUrl(), "erp_runtime_login", "runtime-test-only")) {
            runtime.setAutoCommit(false);
            try (PreparedStatement context = runtime.prepareStatement("select set_config('app.tenant_id', ?, true)")) {
                context.setString(1, A.value().toString()); context.execute();
            }
            UUID reversal = UUID.randomUUID();
            String sql = """
                    insert into accounting_journal(id,tenant_id,sale_id,kind,reversal_id,original_id,fingerprint,created_at,updated_at,created_by,updated_by)
                    values (?,?,?,'REVERSAL',?,?,'test',now(),now(),?,?)
                    """;
            java.sql.SQLException differentSale = assertThrows(java.sql.SQLException.class,
                    () -> execute(runtime, sql, reversal, A.value(), firstSale, UUID.randomUUID(), original, ACTOR, ACTOR));
            assertEquals("23503", differentSale.getSQLState());
            runtime.rollback();
            try (PreparedStatement context = runtime.prepareStatement("select set_config('app.tenant_id', ?, true)")) {
                context.setString(1, A.value().toString()); context.execute();
            }
            java.sql.SQLException selfReference = assertThrows(java.sql.SQLException.class,
                    () -> execute(runtime, sql, reversal, A.value(), firstSale, UUID.randomUUID(), reversal, ACTOR, ACTOR));
            assertEquals("23514", selfReference.getSQLState());
            runtime.rollback();
        }
    }
    private void receive(TenantId tenant, String amount) {
        inventory.receive(tenant, new InventoryMovements.StockCommand(UUID.randomUUID().toString(), "test",
                List.of(new InventoryMovements.Line(product, "unit", new BigDecimal(amount)))));
    }
    private Sales.Command command(UUID id, String quantity, String price, String tax) {
        return new Sales.Command(id, List.of(new Sales.Line(product, "unit", new BigDecimal(quantity),
                new BigDecimal(price), new BigDecimal(tax))));
    }
    private int countSale(UUID saleId, String table) {
        String query = switch (table) {
            case "pos_sale" -> "select count(*) from pos_sale where tenant_id=? and sale_id=?";
            case "accounting_journal" -> "select count(*) from accounting_journal where tenant_id=? and sale_id=?";
            default -> throw new IllegalArgumentException("unknown test table");
        };
        try (Connection db = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             PreparedStatement q = db.prepareStatement(query)) {
            q.setObject(1, A.value()); q.setObject(2, saleId);
            try (var rows = q.executeQuery()) { rows.next(); return rows.getInt(1); }
        } catch (java.sql.SQLException exception) { throw new AssertionError(exception); }
    }
    private static void execute(Connection db, String query, Object... params) throws java.sql.SQLException {
        try (PreparedStatement q = db.prepareStatement(query)) {
            for (int i = 0; i < params.length; i++) { q.setObject(i + 1, params[i]); }
            q.executeUpdate();
        }
    }
}
