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
import org.springframework.transaction.support.TransactionSynchronizationManager;

//SOLID: SRP — ESTE SERVICIO AUTORIZA MEMBRESÍAS Y EJECUTA EL TRABAJO EN SU TRANSACCIÓN.
@Service
public class TenantAccessService implements TenantAccess {
    private final AuthenticatedActor authenticatedActor;
    private final MembershipRepository memberships;
    private final TenantRepository tenants;
    private final PostgresTransactionContext postgresContext;
    private final TransactionTemplate transactionTemplate;
    private final TransactionTemplate joinedTransactionTemplate;

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
        this.joinedTransactionTemplate = new TransactionTemplate(transactionManager);
        this.joinedTransactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_MANDATORY);
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

    @Override
    public <T> T executeJoined(TenantId tenantId, String requiredPermission, TenantOperation<T> operation) {
        if (tenantId == null || requiredPermission == null || requiredPermission.isBlank() || operation == null
                || !TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalArgumentException("authorized transaction, tenant and permission are required");
        }
        return joinedTransactionTemplate.execute(status -> authorizeJoined(tenantId, requiredPermission, operation));
    }

    private <T> T authorizeJoined(TenantId tenantId, String requiredPermission, TenantOperation<T> operation) {
        UUID actorId = authenticatedActor.actorId().value();
        String tenant = tenantId.value().toString();
        if (!tenant.equals(postgresContext.get("app.tenant_id"))
                || !tenant.equals(postgresContext.get("app.requested_tenant_id"))
                || !actorId.toString().equals(postgresContext.get("app.actor_id"))) {
            throw new TenantAccessDeniedException();
        }
        memberships.findByTenantIdAndActorId(tenantId.value(), actorId)
                .filter(member -> member.getStatus() == MembershipStatus.ACTIVE)
                .filter(member -> member.getPermissionCodes().contains(requiredPermission))
                .orElseThrow(TenantAccessDeniedException::new);
        if (tenants.findById(tenantId.value()).map(t -> t.getStatus() != TenantStatus.ACTIVE).orElse(true)) {
            throw new TenantAccessDeniedException();
        }
        String previous = postgresContext.get("app.permission");
        if (previous == null || previous.isBlank()) { throw new TenantAccessDeniedException(); }
        postgresContext.setPermission(requiredPermission);
        try {
            T result = operation.apply(new TenantContext(tenantId, new com.erp.features.identity.api.ActorId(actorId)));
            postgresContext.setPermission(previous);
            return result;
        } catch (RuntimeException | Error failure) {
            try { postgresContext.setPermission(previous); }
            catch (RuntimeException restoreFailure) { failure.addSuppressed(restoreFailure); }
            throw failure;
        }
    }
}
