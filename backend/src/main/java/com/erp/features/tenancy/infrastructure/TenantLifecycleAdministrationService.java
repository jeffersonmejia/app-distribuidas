package com.erp.features.tenancy.infrastructure;

import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantId;
import com.erp.features.tenancy.api.TenantLifecycleAdministration;
import com.erp.features.tenancy.domain.TenantStatus;
import com.erp.features.tenancy.infrastructure.persistence.TenantEntity;
import com.erp.features.tenancy.infrastructure.persistence.TenantRepository;
import org.springframework.stereotype.Service;

//SOLID: SRP — ESTE SERVICIO EJECUTA LAS TRANSICIONES DE ESTADO CON PERMISO EXPLÍCITO.
@Service
public class TenantLifecycleAdministrationService implements TenantLifecycleAdministration {
    private static final String MANAGE_TENANT = "tenancy:tenant:manage";

    private final TenantAccess tenantAccess;
    private final TenantRepository tenants;

    public TenantLifecycleAdministrationService(TenantAccess tenantAccess, TenantRepository tenants) {
        this.tenantAccess = tenantAccess;
        this.tenants = tenants;
    }

    @Override
    public void suspend(TenantId tenantId) {
        changeStatus(tenantId, TenantStatus.SUSPENDED);
    }

    @Override
    public void reactivate(TenantId tenantId) {
        changeStatus(tenantId, TenantStatus.ACTIVE);
    }

    private void changeStatus(TenantId tenantId, TenantStatus status) {
        tenantAccess.execute(tenantId, MANAGE_TENANT, context -> {
            TenantEntity tenant = tenants.findById(tenantId.value())
                    .orElseThrow(TenantAccessDeniedException::new);
            tenant.setStatus(status, context.actorId().value());
            tenants.save(tenant);
            return null;
        });
    }
}
