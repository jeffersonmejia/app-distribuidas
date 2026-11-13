package com.erp.features.identity.api;

//SOLID: ISP — ESTE CONTRATO EXPONE SOLO LA IDENTIDAD AUTENTICADA.
public interface AuthenticatedActor {
    ActorId actorId();
}
