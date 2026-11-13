package com.erp.features.identity.api;

import java.util.UUID;

//SOLID: SRP — ESTE TIPO REPRESENTA EL IDENTIFICADOR PÚBLICO DEL ACTOR.
public record ActorId(UUID value) {
    public ActorId {
        if (value == null) {
            throw new IllegalArgumentException("actor id is required");
        }
    }
}
