package com.erp.features.tenancy.infrastructure;

import org.springframework.security.access.AccessDeniedException;

//SOLID: SRP — ESTA EXCEPCIÓN REPRESENTA UN RECHAZO GENÉRICO DE AUTORIZACIÓN TENANT.
public class TenantAccessDeniedException extends AccessDeniedException {
    public TenantAccessDeniedException() {
        super("tenant access denied");
    }
}
