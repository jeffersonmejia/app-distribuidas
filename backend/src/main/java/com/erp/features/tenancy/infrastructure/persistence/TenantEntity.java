package com.erp.features.tenancy.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;

import com.erp.features.tenancy.domain.TenantStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

//SOLID: SRP — ESTA ENTIDAD PERSISTE EL ESTADO ADMINISTRATIVO DEL TENANT.
@Entity
@Table(name = "tenant")
public class TenantEntity {
    @Id
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TenantStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "updated_by", nullable = false)
    private UUID updatedBy;

    protected TenantEntity() { }

    public TenantStatus getStatus() { return status; }

    public void setStatus(TenantStatus status, UUID actorId) {
        this.status = status;
        this.updatedAt = Instant.now();
        this.updatedBy = actorId;
    }
}
