package com.erp.features.identity.infrastructure.security;

import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

//SOLID: SRP — ESTA CLASE CONFIGURA LA VALIDACIÓN JWT Y LAS RUTAS HTTP.
@Configuration
public class SecurityConfiguration {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .authorizeHttpRequests(authorize -> authorize.anyRequest().authenticated())
                .oauth2ResourceServer(resourceServer -> resourceServer.jwt(jwt -> { }))
                .build();
    }

    @Bean
    JwtDecoder jwtDecoder(
            @Value("${AUTH_ISSUER_URI}") String issuer,
            @Value("${AUTH_AUDIENCE}") String audience) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withIssuerLocation(issuer).build();
        decoder.setJwtValidator(tokenValidator(issuer, audience));
        return decoder;
    }

    static OAuth2TokenValidator<Jwt> tokenValidator(String issuer, String audience) {
        OAuth2TokenValidator<Jwt> audienceValidator = token -> token.getAudience().contains(audience)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(
                        new org.springframework.security.oauth2.core.OAuth2Error("invalid_token"));
        OAuth2TokenValidator<Jwt> subjectValidator = token -> {
            try {
                UUID.fromString(token.getSubject());
                return OAuth2TokenValidatorResult.success();
            } catch (RuntimeException exception) {
                return OAuth2TokenValidatorResult.failure(
                        new org.springframework.security.oauth2.core.OAuth2Error("invalid_token"));
            }
        };
        return new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuer), audienceValidator, subjectValidator);
    }
}
