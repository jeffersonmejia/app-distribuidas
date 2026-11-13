package com.erp.features.identity.infrastructure.security;

import com.erp.features.identity.api.AuthenticatedActor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class AuthProbeController {
    private final AuthenticatedActor actor;

    AuthProbeController(AuthenticatedActor actor) {
        this.actor = actor;
    }

    @GetMapping("/private/actor")
    String actorId() {
        return actor.actorId().value().toString();
    }
}
