package com.erp.features.tenancy.api;

//SOLID: ISP — ESTE CONTRATO REPRESENTA UNA OPERACIÓN EJECUTADA EN UN TENANT.
@FunctionalInterface
public interface TenantOperation<T> {
    T apply(TenantContext context);
}
