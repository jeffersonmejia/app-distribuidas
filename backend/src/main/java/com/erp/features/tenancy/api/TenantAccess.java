package com.erp.features.tenancy.api;

//SOLID: ISP — ESTE CONTRATO EJECUTA TRABAJO SOLO DESPUÉS DE AUTORIZAR LA MEMBRESÍA.
public interface TenantAccess {
    <T> T execute(TenantId tenantId, String requiredPermission, TenantOperation<T> operation);
    default <T> T executeJoined(TenantId tenantId, String requiredPermission, TenantOperation<T> operation) {
        throw new IllegalStateException("joined authorization is unavailable");
    }
}
