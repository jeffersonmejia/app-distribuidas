package com.erp.features.crm;

import static org.junit.jupiter.api.Assertions.*;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

//SOLID: SRP — ESTA SUITE VERIFICA MIGRACIÓN, UNICIDAD Y AISLAMIENTO EN POSTGRESQL.
@Testcontainers(disabledWithoutDocker = true)
class CustomerRlsIntegrationTest {
    private static final UUID A = UUID.fromString("10000000-0000-4000-8000-000000000001");
    private static final UUID B = UUID.fromString("20000000-0000-4000-8000-000000000002");
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @BeforeAll static void migrate() throws Exception {
        try (Connection db = admin(); Statement sql = db.createStatement()) {
            sql.execute("CREATE ROLE erp_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS");
            sql.execute("CREATE ROLE erp_migrator LOGIN PASSWORD 'test-migrator' NOSUPERUSER NOBYPASSRLS");
            sql.execute("CREATE ROLE erp_login LOGIN PASSWORD 'test-runtime' NOSUPERUSER NOBYPASSRLS");
            sql.execute("GRANT erp_runtime TO erp_login");
            sql.execute("GRANT USAGE, CREATE ON SCHEMA public TO erp_migrator");
        }
        Flyway.configure().dataSource(postgres.getJdbcUrl(), "erp_migrator", "test-migrator")
                .locations("classpath:db/migration").target("20261113.001").load().migrate();
        Flyway.configure().dataSource(postgres.getJdbcUrl(), "erp_migrator", "test-migrator")
                .locations("classpath:db/migration").load().migrate();
    }

    @Test void rlsAndUniqueConstraintsIncludeArchivedCustomers() throws Exception {
        try (Connection db = DriverManager.getConnection(postgres.getJdbcUrl(), "erp_login", "test-runtime")) {
            db.setAutoCommit(false);
            assertEquals(0, count(db));
            setTenant(db, A);
            insert(db, A, "1710034065", "ana@example.com", true);
            db.commit();
            assertEquals(0, count(db));
            setTenant(db, B);
            assertEquals(0, count(db));
            insert(db, B, "1710034065", "ana@example.com", false);
            db.commit();
            setTenant(db, A);
            assertEquals(1, count(db));
            SQLException duplicate = assertThrows(SQLException.class,
                    () -> insert(db, A, "1710034065", "otro@example.com", false));
            assertEquals("23505", duplicate.getSQLState());
            db.rollback();
            setTenant(db, A);
            SQLException email = assertThrows(SQLException.class,
                    () -> insert(db, A, null, "ana@example.com", false));
            assertEquals("23505", email.getSQLState());
            db.rollback();
            setTenant(db, A);
            assertThrows(SQLException.class, () -> insert(db, B, null, null, false));
        }
    }

    private static Connection admin() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }
    private static void setTenant(Connection db, UUID tenant) throws SQLException {
        try (PreparedStatement sql = db.prepareStatement("select set_config('app.tenant_id', ?, true)")) {
            sql.setString(1, tenant.toString()); sql.execute();
        }
    }
    private static int count(Connection db) throws SQLException {
        try (Statement sql = db.createStatement(); ResultSet rows = sql.executeQuery("select count(*) from crm_customer")) {
            rows.next(); return rows.getInt(1);
        }
    }
    private static void insert(Connection db, UUID tenant, String cedula, String email, boolean archived)
            throws SQLException {
        try (PreparedStatement sql = db.prepareStatement("""
                insert into crm_customer (id, tenant_id, full_name, cedula, email, status, created_at, updated_at,
                                          created_by, updated_by, deleted_at)
                values (?, ?, 'Test', ?, ?, 'ACTIVE', now(), now(), ?, ?, case when ? then now() end)
                """)) {
            sql.setObject(1, UUID.randomUUID()); sql.setObject(2, tenant); sql.setString(3, cedula);
            sql.setString(4, email); sql.setObject(5, A); sql.setObject(6, A); sql.setBoolean(7, archived);
            sql.executeUpdate();
        }
    }
}
