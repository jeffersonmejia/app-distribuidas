package com.erp.features.marketing.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

//SOLID: SRP — ESTA ENTIDAD VINCULA UN CLIENTE DE CRM CON UNA CAMPAÑA DEL MISMO TENANT.
@Entity
@Table(name = "marketing_campaign_contact")
public class CampaignContactEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(name = "campaign_id", nullable = false, updatable = false) UUID campaignId;
    @Column(name = "customer_id", nullable = false, updatable = false) UUID customerId;
    @Column(name = "created_at", nullable = false, updatable = false) Instant createdAt;
    @Column(name = "created_by", nullable = false, updatable = false) UUID createdBy;

    protected CampaignContactEntity() { }
}
