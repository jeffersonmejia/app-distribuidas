package com.erp.features.marketing.infrastructure.persistence;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import com.erp.features.marketing.domain.model.Campaign;
import com.erp.features.marketing.domain.model.CampaignStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

//SOLID: SRP — ESTA ENTIDAD REPRESENTA LA PERSISTENCIA DE UNA CAMPAÑA.
@Entity
@Table(name = "marketing_campaign")
@org.hibernate.annotations.Check(constraints = "char_length(name) <= 150 AND char_length(description) <= 2000")
public class CampaignEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(nullable = false, columnDefinition = "text") String name;
    @Column(nullable = false, columnDefinition = "text") String description;
    @Column(name = "start_date", nullable = false) LocalDate startDate;
    @Column(name = "end_date", nullable = false) LocalDate endDate;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) CampaignStatus status;
    @Column(name = "created_at", nullable = false, updatable = false) Instant createdAt;
    @Column(name = "updated_at", nullable = false) Instant updatedAt;
    @Column(name = "created_by", nullable = false, updatable = false) UUID createdBy;
    @Column(name = "updated_by", nullable = false) UUID updatedBy;

    protected CampaignEntity() { }

    CampaignEntity(Campaign campaign) { apply(campaign); }

    void apply(Campaign campaign) {
        id = campaign.id();
        tenantId = campaign.tenantId();
        name = campaign.name();
        description = campaign.description();
        startDate = campaign.startDate();
        endDate = campaign.endDate();
        status = campaign.status();
        createdAt = campaign.createdAt();
        updatedAt = campaign.updatedAt();
        createdBy = campaign.createdBy();
        updatedBy = campaign.updatedBy();
    }

    Campaign toDomain() {
        return new Campaign(id, tenantId, name, description, startDate, endDate, status, createdAt, updatedAt,
                createdBy, updatedBy);
    }
}
