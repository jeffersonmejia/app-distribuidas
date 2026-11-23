package com.erp.features.crm;

import static org.junit.jupiter.api.Assertions.*;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

//SOLID: SRP — ESTA SUITE COMPRUEBA LA MIGRACIÓN Y LOS LÍMITES EN POSTGRESQL.
@Testcontainers(disabledWithoutDocker = true)
class TextLimitsMigrationIntegrationTest {
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withInitScript("db/tenancy-test-roles.sql");

    @Test void preservesLegacyRowsAndEnforcesEveryNewLimit() throws Exception {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), "erp_migrator", "migration-test-only")
                .locations("classpath:db/migration").target("20261122.001").load().migrate();
        String uuid = "'11111111-1111-4111-8111-111111111111'";
        try (Connection db = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement sql = db.createStatement()) {
            sql.execute("insert into crm_customer(id,tenant_id,full_name,status,created_at,updated_at,created_by,updated_by) "
                    + "values (" + uuid + "," + uuid + ",repeat('x',201),'ACTIVE',now(),now()," + uuid + "," + uuid + ")");
            String audit = ",now(),now()," + uuid + "," + uuid + ")";
            sql.execute("insert into projects_project(id,tenant_id,name,created_at,updated_at,created_by,updated_by) values ("
                    + uuid + "," + uuid + ",'project'" + audit);
            sql.execute("insert into projects_task(id,tenant_id,project_id,title,status,created_at,updated_at,created_by,updated_by) values ("
                    + uuid + "," + uuid + "," + uuid + ",'task','PENDING'" + audit);
            sql.execute("insert into marketing_campaign(id,tenant_id,name,description,start_date,end_date,status,created_at,updated_at,created_by,updated_by) values ("
                    + uuid + "," + uuid + ",'name','description',current_date,current_date,'DRAFT'" + audit);
            sql.execute("insert into marketing_template(id,tenant_id,name,subject,html_body,text_body,created_at,updated_at,created_by,updated_by) values ("
                    + uuid + "," + uuid + ",'name','subject','html','text'" + audit);
        }
        Flyway.configure().dataSource(postgres.getJdbcUrl(), "erp_migrator", "migration-test-only")
                .locations("classpath:db/migration").load().migrate();
        try (Connection db = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement sql = db.createStatement()) {
            try (var rows = sql.executeQuery("select count(*) from crm_customer where char_length(full_name) > 200")) {
                assertTrue(rows.next()); assertEquals(1, rows.getInt(1));
            }
            try (var rows = sql.executeQuery("select count(*) from pg_constraint where conname in "
                    + "('crm_customer_full_name_max','projects_project_name_max','projects_project_description_max',"
                    + "'projects_task_title_max','marketing_campaign_name_max','marketing_campaign_description_max',"
                    + "'marketing_template_html_body_max','marketing_template_text_body_max') and not convalidated")) {
                assertTrue(rows.next()); assertEquals(8, rows.getInt(1));
            }
            SQLException legacyUpdate = assertThrows(SQLException.class,
                    () -> sql.executeUpdate("update crm_customer set updated_at = now()"));
            assertEquals("23514", legacyUpdate.getSQLState());
            for (String[] field : new String[][] {
                    {"crm_customer", "full_name", "200"}, {"projects_project", "name", "150"},
                    {"projects_project", "description", "2000"}, {"projects_task", "title", "200"},
                    {"marketing_campaign", "name", "150"}, {"marketing_campaign", "description", "2000"},
                    {"marketing_template", "html_body", "100000"}, {"marketing_template", "text_body", "50000"}}) {
                String update = "update " + field[0] + " set " + field[1] + " = ?";
                int limit = Integer.parseInt(field[2]);
                try (var statement = db.prepareStatement(update)) {
                    statement.setString(1, "😀".repeat(limit));
                    assertEquals(1, statement.executeUpdate());
                    statement.setString(1, "😀".repeat(limit + 1));
                    SQLException rejected = assertThrows(SQLException.class, statement::executeUpdate);
                    assertEquals("23514", rejected.getSQLState(), field[0] + "." + field[1]);
                }
            }
        }
    }
}
