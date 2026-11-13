package com.erp.features.tenancy.api;

//SOLID: ISP — ESTE CONTRATO EJECUTA TRABAJO SOLO DESPUÉS DE AUTORIZAR LA MEMBRESÍA.
public interface TenantAccess {
    <T> T execute(TenantId tenantId, String requiredPermission, TenantOperation<T> operation);
}
