package com.erp.features.marketing;

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

//SOLID: SRP — ESTA SUITE VERIFICA MIGRACIÓN, CONSTRAINTS Y AISLAMIENTO RLS DE MARKETING EN POSTGRESQL.
@Testcontainers(disabledWithoutDocker = true)
class MarketingRlsIntegrationTest {
    private static final UUID A = UUID.fromString("10000000-0000-4000-8000-0000000000a1");
    private static final UUID B = UUID.fromString("20000000-0000-4000-8000-0000000000b2");
    private static final String[] TABLES = {"marketing_campaign", "marketing_template",
            "marketing_contact_preference", "marketing_campaign_contact", "marketing_delivery"};
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @BeforeAll static void migrate() throws Exception {
        try (Connection db = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(),
                postgres.getPassword()); Statement sql = db.createStatement()) {
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
            UUID campaign = UUID.randomUUID();
            UUID template = UUID.randomUUID();
            UUID customer = UUID.randomUUID();
            assertThrows(SQLException.class, () -> insertCampaign(db, A, campaign));
            db.rollback();

            setTenant(db, A);
            insertCampaign(db, A, campaign);
            exec(db, "insert into marketing_template values ('" + template + "','" + A
                    + "','T','S','<p>h</p>','t',now(),now(),'" + A + "','" + A + "')");
            exec(db, "insert into marketing_contact_preference values (gen_random_uuid(),'" + A + "','" + customer
                    + "','CONSENTED',now(),now(),'" + A + "','" + A + "')");
            exec(db, "insert into marketing_campaign_contact values (gen_random_uuid(),'" + A + "','" + campaign
                    + "','" + customer + "',now(),'" + A + "')");
            exec(db, "insert into marketing_delivery values (gen_random_uuid(),'" + A + "','" + campaign + "','"
                    + template + "','" + customer + "',now(),'" + A + "')");
            db.commit();

            // Sin contexto y desde otro tenant no se ve ni se modifica ninguna fila.
            for (String table : TABLES) { assertEquals(0, count(db, table)); }
            setTenant(db, B);
            for (String table : TABLES) { assertEquals(0, count(db, table)); }
            assertEquals(0, exec(db, "update marketing_campaign set status = 'CANCELLED'"));
            assertEquals(0, exec(db, "update marketing_contact_preference set status = 'CONSENTED'"));
            assertEquals(0, exec(db, "delete from marketing_campaign_contact"));
            assertThrows(SQLException.class, () -> insertCampaign(db, A, UUID.randomUUID()));
            db.rollback();

            // Una referencia a la campaña de otro tenant es rechazada por la clave foránea compuesta.
            setTenant(db, B);
            assertEquals("23503", assertThrows(SQLException.class, () -> exec(db,
                    "insert into marketing_campaign_contact values (gen_random_uuid(),'" + B + "','" + campaign
                            + "','" + customer + "',now(),'" + B + "')")).getSQLState());
            db.rollback();

            setTenant(db, A);
            for (String table : TABLES) { assertEquals(1, count(db, table)); }
            // El runtime no puede borrar ni alterar el historial de entregas.
            assertThrows(SQLException.class, () -> exec(db, "delete from marketing_delivery"));
            db.rollback();
        }
    }

    @Test void constraintsProtectInvariants() throws Exception {
        try (Connection db = runtime()) {
            db.setAutoCommit(false);
            String campaign = "insert into marketing_campaign values (gen_random_uuid(),'" + A + "',%s,now(),now(),'"
                    + A + "','" + A + "')";
            for (String values : new String[]{"'P','D','2026-02-01','2026-01-01','DRAFT'",
                    "'P','  ','2026-01-01','2026-01-01','DRAFT'", "'P','D','2026-01-01','2026-01-01','PAUSED'"}) {
                setTenant(db, A);
                assertEquals("23514", assertThrows(SQLException.class,
                        () -> exec(db, campaign.formatted(values))).getSQLState());
                db.rollback();
            }
            setTenant(db, A);
            UUID customer = UUID.randomUUID();
            String preference = "insert into marketing_contact_preference values (gen_random_uuid(),'" + A + "','"
                    + customer + "','UNSUBSCRIBED',now(),now(),'" + A + "','" + A + "')";
            exec(db, preference);
            assertEquals("23505", assertThrows(SQLException.class, () -> exec(db, preference)).getSQLState());
            db.rollback();
        }
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
        try (Statement sql = db.createStatement(); ResultSet rows = sql.executeQuery("select count(*) from " + table)) {
            rows.next(); return rows.getInt(1);
        }
    }
    private static int exec(Connection db, String statement) throws SQLException {
        try (Statement sql = db.createStatement()) { return sql.executeUpdate(statement); }
    }
    private static void insertCampaign(Connection db, UUID tenant, UUID id) throws SQLException {
        exec(db, "insert into marketing_campaign values ('" + id + "','" + tenant
                + "','P','D','2026-01-01','2026-01-02','DRAFT',now(),now(),'" + A + "','" + A + "')");
    }
}
