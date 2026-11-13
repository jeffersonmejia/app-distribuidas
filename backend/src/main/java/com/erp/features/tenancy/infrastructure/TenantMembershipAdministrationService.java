package com.erp.features.tenancy.infrastructure;

import java.util.Set;
import java.util.UUID;

import com.erp.features.identity.api.ActorId;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantId;
import com.erp.features.tenancy.api.TenantMembershipAdministration;
import com.erp.features.tenancy.domain.MembershipStatus;
import com.erp.features.tenancy.infrastructure.persistence.MembershipEntity;
import com.erp.features.tenancy.infrastructure.persistence.MembershipRepository;
import org.springframework.stereotype.Service;

//SOLID: SRP — ESTE SERVICIO CONCEDE O REVOCA MEMBRESÍAS CON PERMISO DE ADMINISTRACIÓN.
@Service
public class TenantMembershipAdministrationService implements TenantMembershipAdministration {
    private static final String MANAGE_MEMBERSHIPS = "tenancy:membership:manage";

    private final TenantAccess tenantAccess;
    private final MembershipRepository memberships;

    public TenantMembershipAdministrationService(TenantAccess tenantAccess, MembershipRepository memberships) {
        this.tenantAccess = tenantAccess;
        this.memberships = memberships;
    }

    @Override
    public void grant(TenantId tenantId, ActorId targetActor, Set<String> permissions) {
        validateTargetAndPermissions(targetActor, permissions);
        tenantAccess.execute(tenantId, MANAGE_MEMBERSHIPS, context -> {
            UUID grantor = context.actorId().value();
            UUID target = targetActor.value();
            if (grantor.equals(target)) {
                throw new TenantAccessDeniedException();
            }
            MembershipEntity membership = memberships.findByTenantIdAndActorId(tenantId.value(), target)
                    .map(existing -> {
                        existing.update(MembershipStatus.ACTIVE, grantor, permissions);
                        return existing;
                    })
                    .orElseGet(() -> MembershipEntity.newActive(
                            UUID.randomUUID(), tenantId.value(), target, grantor, permissions));
            memberships.save(membership);
            return null;
        });
    }

    @Override
    public void revoke(TenantId tenantId, ActorId targetActor) {
        if (targetActor == null) {
            throw new IllegalArgumentException("target actor is required");
        }
        tenantAccess.execute(tenantId, MANAGE_MEMBERSHIPS, context -> {
            UUID grantor = context.actorId().value();
            if (grantor.equals(targetActor.value())) {
                throw new TenantAccessDeniedException();
            }
            MembershipEntity membership = memberships.findByTenantIdAndActorId(tenantId.value(), targetActor.value())
                    .orElseThrow(TenantAccessDeniedException::new);
            membership.update(MembershipStatus.REVOKED, grantor, Set.of());
            memberships.save(membership);
            return null;
        });
    }

    private void validateTargetAndPermissions(ActorId targetActor, Set<String> permissions) {
        if (targetActor == null || permissions == null
                || permissions.stream().anyMatch(permission -> permission == null
                        || permission.isBlank() || permission.length() > 120)) {
            throw new IllegalArgumentException("target actor and valid explicit permissions are required");
        }
    }
}
