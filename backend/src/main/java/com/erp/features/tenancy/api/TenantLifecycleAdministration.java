package com.erp.features.tenancy.api;

//SOLID: ISP — ESTE CONTRATO EXPONE SOLO LAS TRANSICIONES ADMINISTRATIVAS DEL TENANT.
public interface TenantLifecycleAdministration {
    void suspend(TenantId tenantId);
    void reactivate(TenantId tenantId);
}
