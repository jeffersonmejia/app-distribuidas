package com.erp.features.identity.infrastructure.security;

import java.util.UUID;

import com.erp.features.identity.api.ActorId;
import com.erp.features.identity.api.AuthenticatedActor;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

//SOLID: SRP — ESTA CLASE ADAPTA EL PRINCIPAL JWT AL CONTRATO PÚBLICO DEL ACTOR.
@Component
public class SecurityAuthenticatedActor implements AuthenticatedActor {
    @Override
    public ActorId actorId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication)
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new IllegalStateException("authenticated actor is unavailable");
        }
        return new ActorId(UUID.fromString(jwtAuthentication.getToken().getSubject()));
    }
}
