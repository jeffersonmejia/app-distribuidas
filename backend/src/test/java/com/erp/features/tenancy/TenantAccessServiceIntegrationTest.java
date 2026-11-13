package com.erp.features.tenancy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.erp.features.identity.api.ActorId;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantId;
import com.erp.features.tenancy.api.TenantLifecycleAdministration;
import com.erp.features.tenancy.api.TenantMembershipAdministration;
import com.erp.features.tenancy.infrastructure.TenantAccessDeniedException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

//SOLID: SRP — ESTA SUITE COMPRUEBA EL ADAPTADOR JPA Y EL ACCESO TENANT CON POSTGRESQL REAL.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK, properties = {
        "AUTH_ISSUER_URI=https://issuer.example.test/",
        "AUTH_AUDIENCE=erp-api"
})
@Testcontainers(disabledWithoutDocker = true)
class TenantAccessServiceIntegrationTest {
    private static final UUID TENANT_A = UUID.fromString("71000000-0000-4000-8000-000000000001");
    private static final UUID TENANT_B = UUID.fromString("72000000-0000-4000-8000-000000000002");
    private static final UUID ACTOR_A = UUID.fromString("73000000-0000-4000-8000-000000000003");
    private static final UUID ACTOR_B = UUID.fromString("74000000-0000-4000-8000-000000000004");
    private static final UUID MEMBERSHIP_A = UUID.fromString("75000000-0000-4000-8000-000000000005");
    private static final UUID MEMBERSHIP_B = UUID.fromString("76000000-0000-4000-8000-000000000006");
    private static final String MIGRATOR_PASSWORD = "migration-test-only";

    @Container
    private static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("erp")
            .withUsername("postgres")
            .withPassword("postgres-test-only")
            .withInitScript("db/tenancy-test-roles.sql");

    @Autowired
    private TenantAccess tenantAccess;

    @Autowired
    private TenantMembershipAdministration membershipAdministration;

    @Autowired
    private TenantLifecycleAdministration tenantLifecycleAdministration;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @MockBean
    private JwtDecoder jwtDecoder;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", () -> "erp_runtime_login");
        registry.add("spring.datasource.password", () -> "runtime-test-only");
        registry.add("spring.flyway.url", postgres::getJdbcUrl);
        registry.add("spring.flyway.user", () -> "erp_migrator");
        registry.add("spring.flyway.password", () -> MIGRATOR_PASSWORD);
    }

    @BeforeEach
    void prepareDataAndAuthenticate() throws Exception {
        try (Connection admin = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
                Statement sql = admin.createStatement()) {
            sql.execute("INSERT INTO tenant (id, status, created_by, updated_by) VALUES "
                    + "('" + TENANT_A + "', 'ACTIVE', '" + ACTOR_A + "', '" + ACTOR_A + "'), "
                    + "('" + TENANT_B + "', 'ACTIVE', '" + ACTOR_B + "', '" + ACTOR_B + "') ON CONFLICT DO NOTHING");
            sql.execute("INSERT INTO tenant_membership (id, tenant_id, actor_id, status, created_by, updated_by) VALUES "
                    + "('" + MEMBERSHIP_A + "', '" + TENANT_A + "', '" + ACTOR_A + "', 'ACTIVE', '" + ACTOR_A + "', '" + ACTOR_A + "'), "
                    + "('" + MEMBERSHIP_B + "', '" + TENANT_B + "', '" + ACTOR_B + "', 'ACTIVE', '" + ACTOR_B + "', '" + ACTOR_B + "') ON CONFLICT DO NOTHING");
            sql.execute("INSERT INTO tenant_membership_permission (tenant_id, membership_id, permission_code) VALUES "
                    + "('" + TENANT_A + "', '" + MEMBERSHIP_A + "', 'crm:read'), "
                    + "('" + TENANT_A + "', '" + MEMBERSHIP_A + "', 'tenancy:membership:manage'), "
                    + "('" + TENANT_A + "', '" + MEMBERSHIP_A + "', 'tenancy:tenant:manage') ON CONFLICT DO NOTHING");
        }
        authenticate(ACTOR_A);
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authorizesMembershipPermissionAndClearsTransactionContext() {
        UUID resolved = tenantAccess.execute(new TenantId(TENANT_A), "crm:read", context -> {
            assertEquals(ACTOR_A, context.actorId().value());
            return context.tenantId().value();
        });
        assertEquals(TENANT_A, resolved);
        assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM tenant", Integer.class));
    }

    @Test
    void deniesActorWithoutMembershipInRequestedTenant() {
        assertThrows(TenantAccessDeniedException.class,
                () -> tenantAccess.execute(new TenantId(TENANT_B), "crm:read", ignored -> "should not run"));
    }

    @Test
    void grantsAndRevokesMembershipOnlyThroughExplicitMembershipPermission() {
        membershipAdministration.grant(new TenantId(TENANT_A), new ActorId(ACTOR_B), java.util.Set.of("crm:read"));
        authenticate(ACTOR_B);
        UUID tenant = tenantAccess.execute(new TenantId(TENANT_A), "crm:read", context -> context.tenantId().value());
        assertEquals(TENANT_A, tenant);

        authenticate(ACTOR_A);
        membershipAdministration.revoke(new TenantId(TENANT_A), new ActorId(ACTOR_B));
        authenticate(ACTOR_B);
        assertThrows(TenantAccessDeniedException.class,
                () -> tenantAccess.execute(new TenantId(TENANT_A), "crm:read", ignored -> "should not run"));
    }

    @Test
    void suspendsAndReactivatesTenantOnlyWithTenantManagementPermission() {
        tenantLifecycleAdministration.suspend(new TenantId(TENANT_A));
        assertThrows(TenantAccessDeniedException.class,
                () -> tenantAccess.execute(new TenantId(TENANT_A), "crm:read", ignored -> "should not run"));

        tenantLifecycleAdministration.reactivate(new TenantId(TENANT_A));
        assertEquals(TENANT_A, tenantAccess.execute(
                new TenantId(TENANT_A), "crm:read", context -> context.tenantId().value()));
    }

    private static void authenticate(UUID actorId) {
        Jwt jwt = Jwt.withTokenValue("test")
                .header("alg", "RS256")
                .issuer("https://issuer.example.test/")
                .subject(actorId.toString())
                .audience(List.of("erp-api"))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, List.of(), actorId.toString()));
    }
}
