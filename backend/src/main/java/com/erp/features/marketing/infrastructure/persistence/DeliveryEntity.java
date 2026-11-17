package com.erp.features.marketing.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

//SOLID: SRP — ESTA ENTIDAD REGISTRA UN CORREO DE CAMPAÑA ENTREGADO AL PROVEEDOR.
@Entity
@Table(name = "marketing_delivery")
public class DeliveryEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(name = "campaign_id", nullable = false, updatable = false) UUID campaignId;
    @Column(name = "template_id", nullable = false, updatable = false) UUID templateId;
    @Column(name = "customer_id", nullable = false, updatable = false) UUID customerId;
    @Column(name = "sent_at", nullable = false, updatable = false) Instant sentAt;
    @Column(name = "created_by", nullable = false, updatable = false) UUID createdBy;

    protected DeliveryEntity() { }

    DeliveryEntity(UUID tenantId, UUID campaignId, UUID templateId, UUID customerId, UUID actorId, Instant now) {
        this.id = UUID.randomUUID();
        this.tenantId = tenantId;
        this.campaignId = campaignId;
        this.templateId = templateId;
        this.customerId = customerId;
        this.sentAt = now;
        this.createdBy = actorId;
    }
}
