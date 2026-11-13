package com.erp.features.tenancy.api;

import java.util.UUID;

//SOLID: SRP — ESTE TIPO REPRESENTA EL IDENTIFICADOR PÚBLICO DEL TENANT.
public record TenantId(UUID value) {
    public TenantId {
        if (value == null) {
            throw new IllegalArgumentException("tenant id is required");
        }
    }
}
