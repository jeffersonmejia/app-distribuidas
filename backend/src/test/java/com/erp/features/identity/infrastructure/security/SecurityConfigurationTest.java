package com.erp.features.identity.infrastructure.security;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.test.web.servlet.MockMvc;

//SOLID: SRP — ESTA SUITE VERIFICA LA BARRERA HTTP Y LA IDENTIDAD DEL ACTOR.
@WebMvcTest(controllers = AuthProbeController.class, properties = {
        "AUTH_ISSUER_URI=https://issuer.example.test/",
        "AUTH_AUDIENCE=erp-api"
})
@Import({SecurityConfiguration.class, SecurityAuthenticatedActor.class})
class SecurityConfigurationTest {
    private static final UUID ACTOR_ID = UUID.fromString("9e16ce97-70e8-4b6b-87ae-4d995457ac56");

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtDecoder jwtDecoder;

    @Test
    void rejectsRequestsWithoutBearerToken() throws Exception {
        mockMvc.perform(get("/private/actor"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsInvalidBearerTokenWithoutReturningDecoderDetails() throws Exception {
        when(jwtDecoder.decode(anyString())).thenThrow(new BadJwtException("private decoder detail"));
        mockMvc.perform(get("/private/actor").header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(""));
    }

    @Test
    void publishesActorFromAuthenticatedJwtSubject() throws Exception {
        mockMvc.perform(get("/private/actor").with(jwt().jwt(token -> token.subject(ACTOR_ID.toString()))))
                .andExpect(status().isOk())
                .andExpect(content().string(ACTOR_ID.toString()));
    }

    @Test
    void validatesAudienceAndUuidSubject() {
        Instant now = Instant.now();
        Jwt valid = Jwt.withTokenValue("test")
                .header("alg", "RS256")
                .issuer("https://issuer.example.test/")
                .subject(ACTOR_ID.toString())
                .audience(List.of("erp-api"))
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .build();
        Jwt wrongAudience = Jwt.withTokenValue("test")
                .header("alg", "RS256")
                .issuer("https://issuer.example.test/")
                .subject(ACTOR_ID.toString())
                .audience(List.of("other-api"))
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .build();
        Jwt invalidSubject = Jwt.withTokenValue("test")
                .header("alg", "RS256")
                .issuer("https://issuer.example.test/")
                .subject("client-supplied-name")
                .audience(List.of("erp-api"))
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .build();

        var validator = SecurityConfiguration.tokenValidator("https://issuer.example.test/", "erp-api");
        assertTrue(validator.validate(valid).getErrors().isEmpty());
        assertTrue(!validator.validate(wrongAudience).getErrors().isEmpty());
        assertTrue(!validator.validate(invalidSubject).getErrors().isEmpty());
    }
}
