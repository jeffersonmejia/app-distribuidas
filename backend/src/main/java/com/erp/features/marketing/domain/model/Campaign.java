package com.erp.features.marketing.domain.model;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

//SOLID: SRP — ESTE MODELO PROTEGE LOS DATOS OBLIGATORIOS Y EL ESTADO DE UNA CAMPAÑA.
public record Campaign(UUID id, UUID tenantId, String name, String description, LocalDate startDate,
                       LocalDate endDate, CampaignStatus status, Instant createdAt, Instant updatedAt,
                       UUID createdBy, UUID updatedBy) {
    public Campaign {
        Objects.requireNonNull(id);
        Objects.requireNonNull(tenantId);
        Objects.requireNonNull(status);
        Objects.requireNonNull(createdAt);
        Objects.requireNonNull(updatedAt);
        Objects.requireNonNull(createdBy);
        Objects.requireNonNull(updatedBy);
        if (name == null || name.isBlank() || description == null || description.isBlank()
                || startDate == null || endDate == null || endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("invalid campaign");
        }
        name = name.trim();
        description = description.trim();
    }

    public static Campaign create(UUID id, UUID tenantId, String name, String description, LocalDate startDate,
                                  LocalDate endDate, UUID actorId, Instant now) {
        return new Campaign(id, tenantId, name, description, startDate, endDate, CampaignStatus.DRAFT,
                now, now, actorId, actorId);
    }

    public Campaign moveTo(CampaignStatus next, UUID actorId, Instant now) {
        if (!status.canMoveTo(next)) { throw new IllegalStateException("invalid campaign transition"); }
        return new Campaign(id, tenantId, name, description, startDate, endDate, next, createdAt, now,
                createdBy, actorId);
    }
}
