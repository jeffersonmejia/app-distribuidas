package com.erp.features.marketing;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;
import java.util.UUID;
import com.erp.features.marketing.application.port.out.CampaignMailer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

//SOLID: SRP — ESTA SUITE COMPRUEBA EL FLUJO HTTP DE MARKETING CON POSTGRESQL, CRM Y AUTORIZACIÓN REALES.
@SpringBootTest(properties = {"AUTH_ISSUER_URI=https://issuer.example.test/", "AUTH_AUDIENCE=erp-api",
        "marketing.mail.daily-limit=2"})
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class MarketingHttpIntegrationTest {
    private static final UUID TENANT = UUID.fromString("11000000-0000-4000-8000-000000000001");
    private static final UUID OTHER = UUID.fromString("22000000-0000-4000-8000-000000000002");
    private static final UUID ACTOR = UUID.fromString("33000000-0000-4000-8000-000000000003");
    private static final UUID MEMBER = UUID.fromString("44000000-0000-4000-8000-000000000004");
    private static final UUID OTHER_MEMBER = UUID.fromString("55000000-0000-4000-8000-000000000005");
    private static final String CAMPAIGNS = "/api/v1/marketing/campaigns";
    private static final String TEMPLATES = "/api/v1/marketing/templates";
    private static final String CONTACTS = "/api/v1/marketing/contacts/";
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withInitScript("db/tenancy-test-roles.sql");
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean JwtDecoder decoder;
    @MockBean CampaignMailer mailer;

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
                    + MEMBER + "','" + TENANT + "','" + ACTOR + "','ACTIVE','" + ACTOR + "','" + ACTOR + "'), ('"
                    + OTHER_MEMBER + "','" + OTHER + "','" + ACTOR + "','ACTIVE','" + ACTOR + "','" + ACTOR
                    + "') on conflict do nothing");
            for (String permission : new String[]{"crm:customers:create", "crm:customers:read",
                    "marketing:campaigns:read", "marketing:campaigns:manage", "marketing:campaigns:send",
                    "marketing:templates:read", "marketing:templates:manage", "marketing:consents:manage"}) {
                sql.execute("insert into tenant_membership_permission(tenant_id,membership_id,permission_code) values ('"
                        + TENANT + "','" + MEMBER + "','" + permission + "') on conflict do nothing");
            }
            // En el otro tenant el actor solo puede leer: no hereda permisos del primero.
            for (String permission : new String[]{"crm:customers:read", "marketing:campaigns:read",
                    "marketing:templates:read"}) {
                sql.execute("insert into tenant_membership_permission(tenant_id,membership_id,permission_code) values ('"
                        + OTHER + "','" + OTHER_MEMBER + "','" + permission + "') on conflict do nothing");
            }
        }
    }

    @Test void campaignAndTemplateLimitsCountUnicodeCodePoints() throws Exception {
        String name = "😀".repeat(150), description = "😀".repeat(2000);
        var campaign = new java.util.HashMap<String, String>();
        campaign.put("name", name); campaign.put("description", description);
        campaign.put("startDate", "2026-11-20"); campaign.put("endDate", "2026-11-30");
        call(post(CAMPAIGNS), TENANT, json.writeValueAsString(campaign)).andExpect(status().isCreated());
        for (String field : List.of("name", "description")) {
            var invalid = new java.util.HashMap<>(campaign); invalid.put(field, invalid.get(field) + "😀");
            call(post(CAMPAIGNS), TENANT, json.writeValueAsString(invalid)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_CAMPAIGN_DATA"))
                    .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("😀"))));
        }
        var template = new java.util.HashMap<String, String>();
        template.put("name", "T"); template.put("subject", "S");
        template.put("htmlBody", "😀".repeat(100000)); template.put("textBody", "😀".repeat(50000));
        String id = id(call(post(TEMPLATES), TENANT, json.writeValueAsString(template)).andExpect(status().isCreated()));
        for (String field : List.of("htmlBody", "textBody")) {
            var invalid = new java.util.HashMap<>(template); invalid.put(field, invalid.get(field) + "😀");
            for (var request : List.of(post(TEMPLATES), put(TEMPLATES + "/" + id))) {
                call(request, TENANT, json.writeValueAsString(invalid)).andExpect(status().isBadRequest())
                        .andExpect(jsonPath("$.code").value("INVALID_TEMPLATE_DATA"))
                        .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("😀"))));
            }
        }
    }

    @Test void managesCampaignsContactsConsentAndManualSendWithTenantIsolation() throws Exception {
        mvc.perform(get(CAMPAIGNS)).andExpect(status().isUnauthorized());
        String a = customer("Ana", "ana@example.test");
        String b = customer("Beto", "beto@example.test");
        String c = customer("Caro", "caro@example.test");
        String d = customer("Dani", "dani@example.test");

        // Campaña: cuatro campos obligatorios, aislamiento por tenant y paginación máxima de 5.
        call(post(CAMPAIGNS), TENANT, "{\"name\":\"Promo\",\"startDate\":\"2026-11-20\",\"endDate\":\"2026-11-30\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_CAMPAIGN_DATA"));
        String body = "{\"name\":\"Promo\",\"description\":\"Ofertas\",\"startDate\":\"2026-11-20\",\"endDate\":\"2026-11-30\"}";
        String campaign = id(call(post(CAMPAIGNS), TENANT, body).andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT")));
        call(post(CAMPAIGNS), OTHER, body).andExpect(status().isForbidden());
        call(get(CAMPAIGNS + "/" + campaign), OTHER, null).andExpect(status().isNotFound());
        call(get(CAMPAIGNS), OTHER, null).andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        call(get(CAMPAIGNS).param("status", "DRAFT"), TENANT, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(campaign));
        call(get(CAMPAIGNS).param("size", "6"), TENANT, null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PAGE"));
        call(get(CAMPAIGNS).param("status", "NOPE"), TENANT, null).andExpect(status().isBadRequest());

        // Plantilla reutilizable con asunto, HTML y texto.
        call(post(TEMPLATES), TENANT, "{\"name\":\"T\",\"subject\":\"Hola\",\"htmlBody\":\"<script>x</script>\",\"textBody\":\"x\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_TEMPLATE_DATA"));
        String template = id(call(post(TEMPLATES), TENANT,
                "{\"name\":\"T\",\"subject\":\"Hola\",\"htmlBody\":\"<p>Oferta</p>\",\"textBody\":\"Oferta\"}")
                .andExpect(status().isCreated()));
        call(put(TEMPLATES + "/" + template), TENANT,
                "{\"name\":\"T\",\"subject\":\"Novedades\",\"htmlBody\":\"<p>Oferta</p>\",\"textBody\":\"Oferta\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.subject").value("Novedades"));
        call(get(TEMPLATES), TENANT, null).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(template));
        call(get(TEMPLATES + "/" + template), OTHER, null).andExpect(status().isNotFound());

        // Contactos de CRM y consentimiento administrado por Marketing.
        for (String customer : List.of(a, b, c, d)) {
            call(put(CAMPAIGNS + "/" + campaign + "/contacts/" + customer), TENANT, null).andExpect(status().isNoContent());
        }
        call(put(CAMPAIGNS + "/" + campaign + "/contacts/" + a), TENANT, null).andExpect(status().isNoContent());
        call(put(CAMPAIGNS + "/" + campaign + "/contacts/" + UUID.randomUUID()), TENANT, null)
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CONTACT_NOT_FOUND"));
        for (String customer : List.of(a, b, c)) {
            call(put(CONTACTS + customer + "/consent"), TENANT, null).andExpect(status().isNoContent());
        }
        call(put(CONTACTS + c + "/unsubscribe"), TENANT, null).andExpect(status().isNoContent());
        call(put(CONTACTS + c + "/consent"), TENANT, null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONTACT_UNSUBSCRIBED"));
        call(put(CONTACTS + a + "/consent"), OTHER, null).andExpect(status().isNotFound());
        call(get(CAMPAIGNS + "/" + campaign + "/contacts"), TENANT, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(4))
                .andExpect(jsonPath("$.items[?(@.customerId=='" + a + "')].consent").value("CONSENTED"))
                .andExpect(jsonPath("$.items[?(@.customerId=='" + c + "')].consent").value("UNSUBSCRIBED"))
                .andExpect(jsonPath("$.items[?(@.customerId=='" + d + "')].consent").value("NONE"));
        call(delete(CAMPAIGNS + "/" + campaign + "/contacts/" + d), TENANT, null).andExpect(status().isNoContent());
        call(get(CAMPAIGNS + "/" + campaign + "/contacts"), TENANT, null)
                .andExpect(jsonPath("$.items.length()").value(3));

        // Estados manuales y envío solo con campaña activa.
        String send = "{\"templateId\":\"" + template + "\"}";
        call(post(CAMPAIGNS + "/" + campaign + "/send"), TENANT, send).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CAMPAIGN_NOT_ACTIVE"));
        moveTo(campaign, "ACTIVE").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_CAMPAIGN_TRANSITION"));
        moveTo(campaign, "SCHEDULED").andExpect(status().isOk());
        moveTo(campaign, "ACTIVE").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        verifyNoInteractions(mailer);
        call(post(CAMPAIGNS + "/" + campaign + "/send"), OTHER, send).andExpect(status().isForbidden());

        // Envío manual: solo a y b tienen consentimiento vigente; el límite diario de la prueba es 2.
        call(post(CAMPAIGNS + "/" + campaign + "/send"), TENANT, send).andExpect(status().isOk())
                .andExpect(jsonPath("$.sent").value(2)).andExpect(jsonPath("$.failed").value(0))
                .andExpect(jsonPath("$.remainingToday").value(0));
        ArgumentCaptor<String> recipients = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> html = ArgumentCaptor.forClass(String.class);
        verify(mailer, times(2)).send(recipients.capture(), eq("Novedades"), html.capture(), eq("Oferta"));
        assertEquals(List.of("ana@example.test", "beto@example.test"), recipients.getAllValues().stream().sorted().toList());
        assertTrue(html.getValue().contains("<p>Oferta</p>") && html.getValue().contains("#2563EB"));
        call(post(CAMPAIGNS + "/" + campaign + "/send"), TENANT, send).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DAILY_LIMIT_REACHED"));
        verifyNoMoreInteractions(mailer);

        moveTo(campaign, "FINISHED").andExpect(status().isOk());
        moveTo(campaign, "CANCELLED").andExpect(status().isConflict());
    }

    private String customer(String name, String email) throws Exception {
        return id(call(post("/api/v1/crm/customers"), TENANT,
                "{\"fullName\":\"" + name + "\",\"email\":\"" + email + "\"}").andExpect(status().isCreated()));
    }

    private ResultActions moveTo(String campaign, String status) throws Exception {
        return call(patch(CAMPAIGNS + "/" + campaign + "/status"), TENANT, "{\"status\":\"" + status + "\"}");
    }

    private ResultActions call(MockHttpServletRequestBuilder request, UUID tenant, String body) throws Exception {
        request.with(jwt().jwt(token -> token.subject(ACTOR.toString()))).header("X-Tenant-ID", tenant);
        if (body != null) { request.contentType(MediaType.APPLICATION_JSON).content(body); }
        return mvc.perform(request);
    }

    private String id(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString()).get("id").asText();
    }
}
