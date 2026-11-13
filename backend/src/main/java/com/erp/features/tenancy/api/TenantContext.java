package com.erp.features.tenancy.api;

import com.erp.features.identity.api.ActorId;

//SOLID: SRP — ESTE TIPO TRANSPORTA EL CONTEXTO TENANT YA AUTORIZADO.
public record TenantContext(TenantId tenantId, ActorId actorId) {
    public TenantContext {
        if (tenantId == null || actorId == null) {
            throw new IllegalArgumentException("tenant and actor context are required");
        }
    }
}
