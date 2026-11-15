package com.erp.features.projects;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.UUID;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

//SOLID: SRP — ESTA SUITE COMPRUEBA EL FLUJO HTTP DE PROYECTOS CON POSTGRESQL, RLS Y PERMISOS REALES.
@SpringBootTest(properties = {"AUTH_ISSUER_URI=https://issuer.example.test/", "AUTH_AUDIENCE=erp-api"})
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class ProjectsHttpIntegrationTest {
    private static final UUID TENANT = UUID.fromString("a1000000-0000-4000-8000-000000000001");
    private static final UUID OTHER = UUID.fromString("a2000000-0000-4000-8000-000000000002");
    private static final UUID FULL = UUID.fromString("a3000000-0000-4000-8000-000000000003");
    private static final UUID READER = UUID.fromString("a4000000-0000-4000-8000-000000000004");
    private static final UUID MEMBER_FULL = UUID.fromString("a5000000-0000-4000-8000-000000000005");
    private static final UUID MEMBER_READER = UUID.fromString("a6000000-0000-4000-8000-000000000006");
    private static final UUID MEMBER_OTHER = UUID.fromString("a7000000-0000-4000-8000-000000000007");
    private static final String[] ALL = {"read", "create", "update", "delete", "purge"};
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withInitScript("db/tenancy-test-roles.sql");
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean JwtDecoder decoder;

    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", () -> "erp_runtime_login");
        registry.add("spring.datasource.password", () -> "runtime-test-only");
        registry.add("spring.flyway.url", postgres::getJdbcUrl);
        registry.add("spring.flyway.user", () -> "erp_migrator");
        registry.add("spring.flyway.password", () -> "migration-test-only");
    }

    @BeforeEach void seed() throws Exception {
        try (Connection db = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement sql = db.createStatement()) {
            for (UUID tenant : new UUID[]{TENANT, OTHER}) {
                sql.execute("insert into tenant(id,status,created_by,updated_by) values ('" + tenant + "','ACTIVE','"
                        + FULL + "','" + FULL + "') on conflict do nothing");
            }
            membership(sql, MEMBER_FULL, TENANT, FULL);
            membership(sql, MEMBER_READER, TENANT, READER);
            membership(sql, MEMBER_OTHER, OTHER, FULL);
            for (String kind : new String[]{"projects", "tasks"}) {
                for (String permission : ALL) {
                    permission(sql, TENANT, MEMBER_FULL, "projects:" + kind + ":" + permission);
                    permission(sql, OTHER, MEMBER_OTHER, "projects:" + kind + ":" + permission);
                }
                permission(sql, TENANT, MEMBER_READER, "projects:" + kind + ":read");
            }
        }
    }

    private static void membership(Statement sql, UUID id, UUID tenant, UUID actor) throws Exception {
        sql.execute("insert into tenant_membership(id,tenant_id,actor_id,status,created_by,updated_by) values ('"
                + id + "','" + tenant + "','" + actor + "','ACTIVE','" + FULL + "','" + FULL + "') on conflict do nothing");
    }
    private static void permission(Statement sql, UUID tenant, UUID membership, String code) throws Exception {
        sql.execute("insert into tenant_membership_permission(tenant_id,membership_id,permission_code) values ('"
                + tenant + "','" + membership + "','" + code + "') on conflict do nothing");
    }
    private static RequestPostProcessor as(UUID actor) { return jwt().jwt(t -> t.subject(actor.toString())); }

    @Test void projectAndTaskLifecycleWithPermissionsAndTenantIsolation() throws Exception {
        String projects = "/api/v1/projects";
        mvc.perform(get(projects)).andExpect(status().isUnauthorized());
        String created = mvc.perform(post(projects).with(as(FULL)).header("X-Tenant-ID", TENANT)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" ERP \",\"startDate\":\"2026-11-01\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("ERP"))
                .andReturn().getResponse().getContentAsString();
        String project = json.readTree(created).get("id").asText();
        mvc.perform(post(projects).with(as(FULL)).header("X-Tenant-ID", TENANT)
                .contentType(MediaType.APPLICATION_JSON).content("{\"description\":\"sin nombre\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PROJECT_DATA"));

        // permisos explícitos: el lector no puede crear ni eliminar; un tenant ajeno no ve el proyecto
        mvc.perform(get(projects + "/" + project).with(as(READER)).header("X-Tenant-ID", TENANT)).andExpect(status().isOk());
        mvc.perform(post(projects).with(as(READER)).header("X-Tenant-ID", TENANT)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"X\"}")).andExpect(status().isForbidden());
        mvc.perform(delete(projects + "/" + project).with(as(READER)).header("X-Tenant-ID", TENANT))
                .andExpect(status().isForbidden());
        mvc.perform(get(projects + "/" + project).with(as(FULL)).header("X-Tenant-ID", OTHER))
                .andExpect(status().isNotFound());
        mvc.perform(get(projects).with(as(FULL)).header("X-Tenant-ID", TENANT).param("size", "6"))
                .andExpect(status().isBadRequest());

        String tasks = projects + "/" + project + "/tasks";
        String task = json.readTree(mvc.perform(post(tasks).with(as(FULL)).header("X-Tenant-ID", TENANT)
                .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Diseñar\",\"priority\":\"HIGH\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn().getResponse().getContentAsString()).get("id").asText();
        mvc.perform(patch(tasks + "/" + task + "/status").with(as(FULL)).header("X-Tenant-ID", TENANT)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"COMPLETED\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_TASK_TRANSITION"));
        for (String next : new String[]{"BLOCKED", "PENDING", "IN_PROGRESS", "COMPLETED", "IN_PROGRESS"}) {
            mvc.perform(patch(tasks + "/" + task + "/status").with(as(FULL)).header("X-Tenant-ID", TENANT)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + next + "\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.status").value(next));
        }
        mvc.perform(patch(tasks + "/" + task).with(as(FULL)).header("X-Tenant-ID", TENANT)
                .contentType(MediaType.APPLICATION_JSON).content("{\"priority\":null,\"status\":\"PENDING\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch(tasks + "/" + task).with(as(FULL)).header("X-Tenant-ID", TENANT)
                .contentType(MediaType.APPLICATION_JSON).content("{\"priority\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.priority").doesNotExist());

        // borrado lógico restaurable; la purga exige borrado previo y permiso explícito
        mvc.perform(delete(tasks + "/" + task + "/permanent").with(as(FULL)).header("X-Tenant-ID", TENANT))
                .andExpect(status().isNotFound());
        mvc.perform(delete(tasks + "/" + task).with(as(FULL)).header("X-Tenant-ID", TENANT)).andExpect(status().isNoContent());
        mvc.perform(get(tasks + "/" + task).with(as(FULL)).header("X-Tenant-ID", TENANT)).andExpect(status().isNotFound());
        mvc.perform(get(tasks).with(as(FULL)).header("X-Tenant-ID", TENANT).param("deleted", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(task));
        mvc.perform(post(tasks + "/" + task + "/restore").with(as(FULL)).header("X-Tenant-ID", TENANT))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        mvc.perform(delete(projects + "/" + project).with(as(FULL)).header("X-Tenant-ID", TENANT)).andExpect(status().isNoContent());
        mvc.perform(get(tasks).with(as(FULL)).header("X-Tenant-ID", TENANT)).andExpect(status().isNotFound());
        mvc.perform(delete(projects + "/" + project + "/permanent").with(as(READER)).header("X-Tenant-ID", TENANT))
                .andExpect(status().isForbidden());
        mvc.perform(delete(projects + "/" + project + "/permanent").with(as(FULL)).header("X-Tenant-ID", OTHER))
                .andExpect(status().isNotFound());
        mvc.perform(delete(projects + "/" + project + "/permanent").with(as(FULL)).header("X-Tenant-ID", TENANT))
                .andExpect(status().isNoContent());
        mvc.perform(post(projects + "/" + project + "/restore").with(as(FULL)).header("X-Tenant-ID", TENANT))
                .andExpect(status().isNotFound());
    }
}
