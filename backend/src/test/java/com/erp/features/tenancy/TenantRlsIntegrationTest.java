package com.erp.features.tenancy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeAll;
import org.postgresql.util.PSQLException;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.containers.PostgreSQLContainer;

//SOLID: SRP — ESTA SUITE COMPRUEBA LAS POLÍTICAS RLS Y EL CONTEXTO TRANSACCIONAL REAL.
@Testcontainers(disabledWithoutDocker = true)
class TenantRlsIntegrationTest {
    private static final UUID TENANT_A = UUID.fromString("10000000-0000-4000-8000-000000000001");
    private static final UUID TENANT_B = UUID.fromString("20000000-0000-4000-8000-000000000002");
    private static final UUID ACTOR_A = UUID.fromString("30000000-0000-4000-8000-000000000003");
    private static final UUID ACTOR_B = UUID.fromString("40000000-0000-4000-8000-000000000004");
    private static final UUID MEMBERSHIP_A = UUID.fromString("50000000-0000-4000-8000-000000000005");
    private static final UUID MEMBERSHIP_B = UUID.fromString("60000000-0000-4000-8000-000000000006");
    private static final String MIGRATOR_PASSWORD = "migration-test-only";
    private static final String RUNTIME_PASSWORD = "runtime-test-only";

    @Container
    private static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("erp")
            .withUsername("postgres")
            .withPassword("postgres-test-only");

    @BeforeAll
    static void migrateAndSeed() throws Exception {
        try (Connection admin = adminConnection(); Statement sql = admin.createStatement()) {
            sql.execute("CREATE ROLE erp_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
            sql.execute("CREATE ROLE erp_migrator LOGIN PASSWORD '" + MIGRATOR_PASSWORD
                    + "' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
            sql.execute("CREATE ROLE erp_runtime_login LOGIN PASSWORD '" + RUNTIME_PASSWORD
                    + "' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS");
            sql.execute("GRANT erp_runtime TO erp_runtime_login");
            sql.execute("GRANT USAGE, CREATE ON SCHEMA public TO erp_migrator");
        }
        Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), "erp_migrator", MIGRATOR_PASSWORD)
                .locations("classpath:db/migration")
                .load()
                .migrate();
        try (Connection admin = adminConnection(); Statement sql = admin.createStatement()) {
            sql.execute("INSERT INTO tenant (id, status, created_by, updated_by) VALUES "
                    + "('" + TENANT_A + "', 'ACTIVE', '" + ACTOR_A + "', '" + ACTOR_A + "'), "
                    + "('" + TENANT_B + "', 'ACTIVE', '" + ACTOR_B + "', '" + ACTOR_B + "')");
            sql.execute("INSERT INTO tenant_membership (id, tenant_id, actor_id, status, created_by, updated_by) VALUES "
                    + "('" + MEMBERSHIP_A + "', '" + TENANT_A + "', '" + ACTOR_A + "', 'ACTIVE', '" + ACTOR_A + "', '" + ACTOR_A + "'), "
                    + "('" + MEMBERSHIP_B + "', '" + TENANT_B + "', '" + ACTOR_B + "', 'ACTIVE', '" + ACTOR_B + "', '" + ACTOR_B + "')");
            sql.execute("INSERT INTO tenant_membership_permission (tenant_id, membership_id, permission_code) VALUES "
                    + "('" + TENANT_A + "', '" + MEMBERSHIP_A + "', 'crm:read'), "
                    + "('" + TENANT_A + "', '" + MEMBERSHIP_A + "', 'tenancy:membership:manage')");
        }
    }

    @Test
    void runtimeRoleIsUnprivilegedAndUnscopedReadsFailClosed() throws Exception {
        try (Connection runtime = runtimeConnection()) {
            try (Statement statement = runtime.createStatement();
                    ResultSet role = statement.executeQuery("""
                            SELECT role.rolsuper, role.rolbypassrls,
                                   pg_get_userbyid(table_row.relowner) AS table_owner
                            FROM pg_roles role
                            CROSS JOIN pg_class table_row
                            WHERE role.rolname = current_user AND table_row.relname = 'tenant_membership'
                            """)) {
                role.next();
                assertFalse(role.getBoolean("rolsuper"));
                assertFalse(role.getBoolean("rolbypassrls"));
                assertNotEquals(role.getString("table_owner"), runtime.getMetaData().getUserName());
            }
            assertEquals(0, count(runtime, "SELECT count(*) FROM tenant"));
            assertEquals(0, count(runtime, "SELECT count(*) FROM tenant_membership"));
            assertEquals(0, count(runtime, "SELECT count(*) FROM tenant_membership_permission"));
        }
    }

    @Test
    void actorAndTenantContextExposeOnlyTheSelectedMembership() throws Exception {
        try (Connection runtime = runtimeConnection()) {
            runtime.setAutoCommit(false);
            setContext(runtime, "app.actor_id", ACTOR_A.toString());
            setContext(runtime, "app.requested_tenant_id", TENANT_A.toString());
            setContext(runtime, "app.tenant_id", TENANT_A.toString());
            assertEquals(1, count(runtime, "SELECT count(*) FROM tenant"));
            assertEquals(1, count(runtime, "SELECT count(*) FROM tenant_membership"));
            assertEquals(2, count(runtime, "SELECT count(*) FROM tenant_membership_permission"));
            setContext(runtime, "app.requested_tenant_id", TENANT_B.toString());
            assertEquals(0, count(runtime, "SELECT count(*) FROM tenant_membership"));
            runtime.rollback();
        }
    }

    @Test
    void transactionRollbackClearsContextAndCrossTenantWritesAreRejected() throws Exception {
        try (Connection runtime = runtimeConnection()) {
            runtime.setAutoCommit(false);
            setContext(runtime, "app.actor_id", ACTOR_A.toString());
            setContext(runtime, "app.requested_tenant_id", TENANT_A.toString());
            setContext(runtime, "app.tenant_id", TENANT_A.toString());
            setContext(runtime, "app.permission", "tenancy:membership:manage");
            assertThrows(PSQLException.class, () -> {
                try (PreparedStatement insert = runtime.prepareStatement("""
                        INSERT INTO tenant_membership
                            (id, tenant_id, actor_id, status, created_by, updated_by)
                        VALUES (?, ?, ?, 'ACTIVE', ?, ?)
                        """)) {
                    UUID id = UUID.randomUUID();
                    insert.setObject(1, id);
                    insert.setObject(2, TENANT_B);
                    insert.setObject(3, UUID.randomUUID());
                    insert.setObject(4, ACTOR_A);
                    insert.setObject(5, ACTOR_A);
                    insert.executeUpdate();
                }
            });
            runtime.rollback();
            assertEquals(0, count(runtime, "SELECT count(*) FROM tenant"));
            assertEquals(0, count(runtime, "SELECT count(*) FROM tenant_membership"));
        }
    }

    private static Connection adminConnection() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private static Connection runtimeConnection() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), "erp_runtime_login", RUNTIME_PASSWORD);
    }

    private static long count(Connection connection, String query) throws SQLException {
        try (Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery(query)) {
            result.next();
            return result.getLong(1);
        }
    }

    private static void setContext(Connection connection, String key, String value) throws SQLException {
        try (PreparedStatement setting = connection.prepareStatement("SELECT set_config(?, ?, true)")) {
            setting.setString(1, key);
            setting.setString(2, value);
            setting.execute();
        }
    }
}
