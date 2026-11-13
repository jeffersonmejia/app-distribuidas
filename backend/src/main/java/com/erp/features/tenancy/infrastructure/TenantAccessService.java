package com.erp.features.tenancy.infrastructure;

import java.util.UUID;

import com.erp.features.identity.api.AuthenticatedActor;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantContext;
import com.erp.features.tenancy.api.TenantId;
import com.erp.features.tenancy.api.TenantOperation;
import com.erp.features.tenancy.domain.MembershipStatus;
import com.erp.features.tenancy.domain.TenantStatus;
import com.erp.features.tenancy.infrastructure.persistence.MembershipEntity;
import com.erp.features.tenancy.infrastructure.persistence.MembershipRepository;
import com.erp.features.tenancy.infrastructure.persistence.PostgresTransactionContext;
import com.erp.features.tenancy.infrastructure.persistence.TenantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

//SOLID: SRP — ESTE SERVICIO AUTORIZA MEMBRESÍAS Y EJECUTA EL TRABAJO EN SU TRANSACCIÓN.
@Service
public class TenantAccessService implements TenantAccess {
    private final AuthenticatedActor authenticatedActor;
    private final MembershipRepository memberships;
    private final TenantRepository tenants;
    private final PostgresTransactionContext postgresContext;
    private final TransactionTemplate transactionTemplate;

    public TenantAccessService(
            AuthenticatedActor authenticatedActor,
            MembershipRepository memberships,
            TenantRepository tenants,
            PostgresTransactionContext postgresContext,
            PlatformTransactionManager transactionManager) {
        this.authenticatedActor = authenticatedActor;
        this.memberships = memberships;
        this.tenants = tenants;
        this.postgresContext = postgresContext;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Override
    public <T> T execute(TenantId tenantId, String requiredPermission, TenantOperation<T> operation) {
        if (tenantId == null || requiredPermission == null || requiredPermission.isBlank() || operation == null) {
            throw new IllegalArgumentException("tenant, permission and operation are required");
        }
        UUID actorId = authenticatedActor.actorId().value();
        return transactionTemplate.execute(status -> {
            postgresContext.setActor(actorId.toString());
            postgresContext.setRequestedTenant(tenantId.value().toString());
            MembershipEntity membership = memberships.findByTenantIdAndActorId(tenantId.value(), actorId)
                    .filter(candidate -> candidate.getStatus() == MembershipStatus.ACTIVE)
                    .filter(candidate -> candidate.getPermissionCodes().contains(requiredPermission))
                    .orElseThrow(() -> new TenantAccessDeniedException());
            postgresContext.setTenant(tenantId.value().toString());
            postgresContext.setPermission(requiredPermission);
            boolean activeTenant = tenants.findById(tenantId.value())
                    .map(tenant -> tenant.getStatus() == TenantStatus.ACTIVE)
                    .orElse(false);
            if (!activeTenant && !"tenancy:tenant:manage".equals(requiredPermission)) {
                throw new TenantAccessDeniedException();
            }
            return operation.apply(new TenantContext(tenantId, new com.erp.features.identity.api.ActorId(actorId)));
        });
    }
}
