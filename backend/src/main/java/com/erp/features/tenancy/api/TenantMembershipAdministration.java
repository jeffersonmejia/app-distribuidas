package com.erp.features.tenancy.api;

import java.util.Set;

import com.erp.features.identity.api.ActorId;

//SOLID: ISP — ESTE CONTRATO EXPONE SOLO LAS OPERACIONES DE CICLO DE VIDA DE MEMBRESÍA.
public interface TenantMembershipAdministration {
    void grant(TenantId tenantId, ActorId targetActor, Set<String> permissions);
    void revoke(TenantId tenantId, ActorId targetActor);
}
