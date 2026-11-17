package com.erp.features.marketing.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import com.erp.features.marketing.domain.model.ConsentStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

//SOLID: SRP — ESTA ENTIDAD REPRESENTA EL CONSENTIMIENTO O LA BAJA DE UN CLIENTE DE CRM.
@Entity
@Table(name = "marketing_contact_preference")
public class ContactPreferenceEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(name = "customer_id", nullable = false, updatable = false) UUID customerId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) ConsentStatus status;
    @Column(name = "created_at", nullable = false, updatable = false) Instant createdAt;
    @Column(name = "updated_at", nullable = false) Instant updatedAt;
    @Column(name = "created_by", nullable = false, updatable = false) UUID createdBy;
    @Column(name = "updated_by", nullable = false) UUID updatedBy;

    protected ContactPreferenceEntity() { }

    ContactPreferenceEntity(UUID tenantId, UUID customerId, UUID actorId, Instant now) {
        this.id = UUID.randomUUID();
        this.tenantId = tenantId;
        this.customerId = customerId;
        this.createdAt = now;
        this.createdBy = actorId;
    }
}
