package com.erp.features.crm;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import com.erp.features.crm.api.ActiveCustomers;
import com.erp.features.tenancy.api.TenantId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import com.fasterxml.jackson.databind.ObjectMapper;

//SOLID: SRP — ESTA SUITE COMPRUEBA EL FLUJO HTTP DE CRM CON POSTGRESQL Y AUTORIZACIÓN REAL.
@SpringBootTest(properties = {"AUTH_ISSUER_URI=https://issuer.example.test/", "AUTH_AUDIENCE=erp-api"})
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class CustomerHttpIntegrationTest {
    private static final UUID TENANT = UUID.fromString("11000000-0000-4000-8000-000000000001");
    private static final UUID OTHER = UUID.fromString("22000000-0000-4000-8000-000000000002");
    private static final UUID ACTOR = UUID.fromString("33000000-0000-4000-8000-000000000003");
    private static final UUID MEMBER = UUID.fromString("44000000-0000-4000-8000-000000000004");
    private static final UUID OTHER_MEMBER = UUID.fromString("55000000-0000-4000-8000-000000000005");
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withInitScript("db/tenancy-test-roles.sql");
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired ActiveCustomers activeCustomers;
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
            sql.execute("insert into tenant(id,status,created_by,updated_by) values ('" + TENANT
                    + "','ACTIVE','" + ACTOR + "','" + ACTOR + "'), ('" + OTHER + "','ACTIVE','"
                    + ACTOR + "','" + ACTOR + "') on conflict do nothing");
            sql.execute("insert into tenant_membership(id,tenant_id,actor_id,status,created_by,updated_by) values ('"
                    + MEMBER + "','" + TENANT + "','" + ACTOR + "','ACTIVE','" + ACTOR + "','" + ACTOR
                    + "') on conflict do nothing");
            for (String permission : new String[]{"create", "read", "update", "archive"}) {
                sql.execute("insert into tenant_membership_permission(tenant_id,membership_id,permission_code) values ('"
                        + TENANT + "','" + MEMBER + "','crm:customers:" + permission + "') on conflict do nothing");
            }
            sql.execute("insert into tenant_membership(id,tenant_id,actor_id,status,created_by,updated_by) values ('"
                    + OTHER_MEMBER + "','" + OTHER + "','" + ACTOR + "','ACTIVE','" + ACTOR + "','" + ACTOR
                    + "') on conflict do nothing");
            sql.execute("insert into tenant_membership_permission(tenant_id,membership_id,permission_code) values ('"
                    + OTHER + "','" + OTHER_MEMBER + "','crm:customers:read') on conflict do nothing");
        }
    }

    @Test void managesCustomersAndEnforcesTenantAndPermissions() throws Exception {
        String path = "/api/v1/crm/customers";
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        String body = """
                {"fullName":" Ana ","cedula":"1710034065","email":"ANA@example.com","phone":"123"}
                """;
        String response = mvc.perform(post(path).with(jwt().jwt(token -> token.subject(ACTOR.toString())))
                .header("X-Tenant-ID", TENANT).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.fullName").value("Ana"))
                .andExpect(jsonPath("$.email").value("ana@example.com")).andReturn().getResponse().getContentAsString();
        String id = json.readTree(response).get("id").asText();
        Jwt actorToken = Jwt.withTokenValue("test-token").header("alg", "none")
                .subject(ACTOR.toString()).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(actorToken, List.of()));
        try {
            org.junit.jupiter.api.Assertions.assertEquals("ana@example.com",
                    activeCustomers.findActive(new TenantId(TENANT), List.of(UUID.fromString(id))).get(0).email());
            org.junit.jupiter.api.Assertions.assertTrue(
                    activeCustomers.findActive(new TenantId(OTHER), List.of(UUID.fromString(id))).isEmpty());
        } finally {
            SecurityContextHolder.clearContext();
        }
        mvc.perform(post(path).with(jwt().jwt(t -> t.subject(ACTOR.toString())))
                .header("X-Tenant-ID", TENANT).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CUSTOMER_CEDULA_ALREADY_EXISTS"));
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject(ACTOR.toString()))).header("X-Tenant-ID", TENANT)
                .param("search", "ana")).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(id));
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject(ACTOR.toString()))).header("X-Tenant-ID", TENANT))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(id));
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject(ACTOR.toString()))).header("X-Tenant-ID", TENANT)
                .param("size", "6")).andExpect(status().isBadRequest());
        mvc.perform(get(path + "/" + id).with(jwt().jwt(t -> t.subject(ACTOR.toString())))
                .header("X-Tenant-ID", OTHER)).andExpect(status().isNotFound());
        mvc.perform(delete(path + "/" + id).with(jwt().jwt(t -> t.subject(ACTOR.toString())))
                .header("X-Tenant-ID", OTHER)).andExpect(status().isForbidden());
        mvc.perform(patch(path + "/" + id).with(jwt().jwt(t -> t.subject(ACTOR.toString())))
                .header("X-Tenant-ID", TENANT).contentType(MediaType.APPLICATION_JSON).content("{\"phone\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.phone").doesNotExist());
        mvc.perform(patch(path + "/" + id + "/status").with(jwt().jwt(t -> t.subject(ACTOR.toString())))
                .header("X-Tenant-ID", TENANT).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"INACTIVE\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("INACTIVE"));
        mvc.perform(delete(path + "/" + id).with(jwt().jwt(t -> t.subject(ACTOR.toString())))
                .header("X-Tenant-ID", TENANT)).andExpect(status().isNoContent());
        mvc.perform(get(path + "/" + id).with(jwt().jwt(t -> t.subject(ACTOR.toString())))
                .header("X-Tenant-ID", TENANT)).andExpect(status().isNotFound());
        mvc.perform(post(path + "/" + id + "/restore").with(jwt().jwt(t -> t.subject(ACTOR.toString())))
                .header("X-Tenant-ID", TENANT)).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("INACTIVE"));
    }

    @Test void simultaneousCreatesAllowOnlyOneCustomerPerUniqueIdentifier() throws Exception {
        assertConcurrentConflict("{\"fullName\":\"Prueba concurrente\",\"cedula\":\"0102030400\"}",
                "CUSTOMER_CEDULA_ALREADY_EXISTS");
        assertConcurrentConflict("{\"fullName\":\"Prueba concurrente\",\"email\":\"race@example.test\"}",
                "CUSTOMER_EMAIL_ALREADY_EXISTS");
    }

    private void assertConcurrentConflict(String body, String expectedCode) throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<org.springframework.test.web.servlet.MvcResult> request = () -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) { throw new IllegalStateException("start timeout"); }
                return mvc.perform(post("/api/v1/crm/customers")
                        .with(jwt().jwt(t -> t.subject(ACTOR.toString())))
                        .header("X-Tenant-ID", TENANT).contentType(MediaType.APPLICATION_JSON).content(body))
                        .andReturn();
            };
            Future<org.springframework.test.web.servlet.MvcResult> first = pool.submit(request);
            Future<org.springframework.test.web.servlet.MvcResult> second = pool.submit(request);
            org.junit.jupiter.api.Assertions.assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            var results = List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
            org.junit.jupiter.api.Assertions.assertEquals(List.of(201, 409), results.stream()
                    .map(result -> result.getResponse().getStatus()).sorted().toList());
            var conflict = results.stream().filter(result -> result.getResponse().getStatus() == 409)
                    .findFirst().orElseThrow();
            org.junit.jupiter.api.Assertions.assertEquals(expectedCode,
                    json.readTree(conflict.getResponse().getContentAsString()).get("code").asText());
        }
    }
}
