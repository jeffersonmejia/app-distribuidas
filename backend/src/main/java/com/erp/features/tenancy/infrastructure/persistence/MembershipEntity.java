package com.erp.features.tenancy.infrastructure.persistence;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import com.erp.features.tenancy.domain.MembershipStatus;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinColumns;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

//SOLID: SRP — ESTA ENTIDAD PERSISTE LA MEMBRESÍA Y SUS PERMISOS EXPLÍCITOS.
@Entity
@Table(name = "tenant_membership", uniqueConstraints =
        @UniqueConstraint(name = "uq_tenant_membership_tenant_id", columnNames = {"tenant_id", "id"}))
public class MembershipEntity {
    @Id
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "actor_id", nullable = false)
    private UUID actorId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private MembershipStatus status;

    @ElementCollection
    @CollectionTable(name = "tenant_membership_permission", joinColumns = {
            @JoinColumn(name = "tenant_id", referencedColumnName = "tenant_id"),
            @JoinColumn(name = "membership_id", referencedColumnName = "id")
    })
    @Column(name = "permission_code", nullable = false, length = 120)
    private Set<String> permissionCodes = new HashSet<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "updated_by", nullable = false)
    private UUID updatedBy;

    protected MembershipEntity() { }

    public UUID getTenantId() { return tenantId; }
    public UUID getActorId() { return actorId; }
    public MembershipStatus getStatus() { return status; }
    public Set<String> getPermissionCodes() { return Set.copyOf(permissionCodes); }

    public static MembershipEntity newActive(
            UUID id, UUID tenantId, UUID actorId, UUID createdBy, Set<String> permissions) {
        Instant now = Instant.now();
        MembershipEntity membership = new MembershipEntity();
        membership.id = id;
        membership.tenantId = tenantId;
        membership.actorId = actorId;
        membership.status = MembershipStatus.ACTIVE;
        membership.createdAt = now;
        membership.updatedAt = now;
        membership.createdBy = createdBy;
        membership.updatedBy = createdBy;
        membership.permissionCodes.addAll(permissions);
        return membership;
    }

    public void update(MembershipStatus status, UUID updatedBy, Set<String> permissions) {
        this.status = status;
        this.updatedBy = updatedBy;
        this.updatedAt = Instant.now();
        this.permissionCodes.clear();
        this.permissionCodes.addAll(permissions);
    }
}
