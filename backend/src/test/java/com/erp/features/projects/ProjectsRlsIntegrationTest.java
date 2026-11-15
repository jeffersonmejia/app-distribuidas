package com.erp.features.projects;

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

//SOLID: SRP — ESTA SUITE VERIFICA MIGRACIÓN, CONSTRAINTS Y AISLAMIENTO RLS DE PROYECTOS EN POSTGRESQL.
@Testcontainers(disabledWithoutDocker = true)
class ProjectsRlsIntegrationTest {
    private static final UUID A = UUID.fromString("10000000-0000-4000-8000-0000000000a1");
    private static final UUID B = UUID.fromString("20000000-0000-4000-8000-0000000000b2");
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
                .locations("classpath:db/migration").load().migrate();
    }

    @Test void rlsIsolatesTenantsAndFailsClosedWithoutContext() throws Exception {
        try (Connection db = runtime()) {
            db.setAutoCommit(false);
            assertEquals(0, count(db, "projects_project"));
            assertThrows(SQLException.class, () -> insertProject(db, A, UUID.randomUUID(), false));
            db.rollback();

            setTenant(db, A);
            UUID projectA = UUID.randomUUID();
            insertProject(db, A, projectA, false);
            insertTask(db, A, projectA, UUID.randomUUID());
            db.commit();

            assertEquals(0, count(db, "projects_project"));
            setTenant(db, B);
            assertEquals(0, count(db, "projects_project"));
            assertEquals(0, count(db, "projects_task"));
            assertThrows(SQLException.class, () -> insertProject(db, A, UUID.randomUUID(), false));
            db.rollback();

            setTenant(db, A);
            assertEquals(1, exec(db, "select count(*) from projects_project where id = '" + projectA + "'", true));
            assertEquals(1, exec(db, "select count(*) from projects_task where project_id = '" + projectA + "'", true));
        }
    }

    @Test void foreignKeyRejectsTaskReferencingProjectOfAnotherTenant() throws Exception {
        try (Connection db = runtime()) {
            db.setAutoCommit(false);
            UUID projectA = UUID.randomUUID();
            setTenant(db, A);
            insertProject(db, A, projectA, false);
            db.commit();
            setTenant(db, B);
            SQLException error = assertThrows(SQLException.class, () -> insertTask(db, B, projectA, UUID.randomUUID()));
            assertEquals("23503", error.getSQLState());
            db.rollback();
        }
    }

    @Test void checkConstraintsProtectInvariants() throws Exception {
        try (Connection db = runtime()) {
            db.setAutoCommit(false);
            setTenant(db, A);
            UUID project = UUID.randomUUID();
            insertProject(db, A, project, false);
            assertEquals("23514", assertThrows(SQLException.class,
                    () -> exec(db, "update projects_project set end_date = '2026-01-01', start_date = '2026-02-01'")).getSQLState());
            db.rollback();
            setTenant(db, A);
            insertProject(db, A, project, false);
            assertEquals("23514", assertThrows(SQLException.class,
                    () -> exec(db, "insert into projects_task(id,tenant_id,project_id,title,status,created_at,updated_at,"
                            + "created_by,updated_by) values (gen_random_uuid(),'" + A + "','" + project
                            + "','   ','PENDING',now(),now(),'" + A + "','" + A + "')")).getSQLState());
            db.rollback();
            setTenant(db, A);
            insertProject(db, A, project, false);
            assertEquals("23514", assertThrows(SQLException.class,
                    () -> exec(db, "insert into projects_task(id,tenant_id,project_id,title,status,created_at,updated_at,"
                            + "created_by,updated_by) values (gen_random_uuid(),'" + A + "','" + project
                            + "','T','BLOCKED',now(),now(),'" + A + "','" + A + "')")).getSQLState());
            db.rollback();
        }
    }

    @Test void physicalDeleteOnlyReachesLogicallyDeletedProjectsOfTheTenant() throws Exception {
        try (Connection db = runtime()) {
            db.setAutoCommit(false);
            UUID active = UUID.randomUUID();
            UUID deleted = UUID.randomUUID();
            setTenant(db, A);
            insertProject(db, A, active, false);
            insertProject(db, A, deleted, true);
            db.commit();

            setTenant(db, A);
            assertEquals(0, exec(db, "delete from projects_project where id = '" + active + "'"));
            assertEquals(1, exec(db, "delete from projects_project where id = '" + deleted + "'"));
            db.commit();

            setTenant(db, B);
            assertEquals(0, exec(db, "delete from projects_project where id = '" + active + "'"));
            db.commit();
            setTenant(db, A);
            assertEquals(1, exec(db, "select count(*) from projects_project where id = '" + active + "'", true));
        }
    }

    private static Connection admin() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }
    private static Connection runtime() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), "erp_login", "test-runtime");
    }
    private static void setTenant(Connection db, UUID tenant) throws SQLException {
        try (PreparedStatement sql = db.prepareStatement("select set_config('app.tenant_id', ?, true)")) {
            sql.setString(1, tenant.toString()); sql.execute();
        }
    }
    private static int count(Connection db, String table) throws SQLException {
        return exec(db, "select count(*) from " + table, true);
    }
    private static int exec(Connection db, String statement) throws SQLException { return exec(db, statement, false); }
    private static int exec(Connection db, String statement, boolean query) throws SQLException {
        try (Statement sql = db.createStatement()) {
            if (!query) { return sql.executeUpdate(statement); }
            try (ResultSet rows = sql.executeQuery(statement)) { rows.next(); return rows.getInt(1); }
        }
    }
    private static void insertProject(Connection db, UUID tenant, UUID id, boolean deleted) throws SQLException {
        try (PreparedStatement sql = db.prepareStatement("""
                insert into projects_project (id, tenant_id, name, created_at, updated_at, created_by, updated_by, deleted_at)
                values (?, ?, 'P', now(), now(), ?, ?, case when ? then now() end)
                """)) {
            sql.setObject(1, id); sql.setObject(2, tenant); sql.setObject(3, A); sql.setObject(4, A);
            sql.setBoolean(5, deleted); sql.executeUpdate();
        }
    }
    private static void insertTask(Connection db, UUID tenant, UUID project, UUID id) throws SQLException {
        try (PreparedStatement sql = db.prepareStatement("""
                insert into projects_task (id, tenant_id, project_id, title, status, created_at, updated_at, created_by, updated_by)
                values (?, ?, ?, 'T', 'PENDING', now(), now(), ?, ?)
                """)) {
            sql.setObject(1, id); sql.setObject(2, tenant); sql.setObject(3, project);
            sql.setObject(4, A); sql.setObject(5, A); sql.executeUpdate();
        }
    }
}
