package com.erp.features.projects.domain.model;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

//SOLID: SRP — ESTE MODELO PROTEGE EL ESTADO Y LA AUDITORÍA DEL PROYECTO.
public record Project(UUID id, UUID tenantId, ProjectDetails details, Instant createdAt, Instant updatedAt,
                      UUID createdBy, UUID updatedBy, Instant deletedAt) {
    public Project {
        Objects.requireNonNull(id);
        Objects.requireNonNull(tenantId);
        Objects.requireNonNull(details);
        Objects.requireNonNull(createdAt);
        Objects.requireNonNull(updatedAt);
        Objects.requireNonNull(createdBy);
        Objects.requireNonNull(updatedBy);
    }

    public static Project create(UUID id, UUID tenantId, ProjectDetails details, UUID actorId, Instant now) {
        return new Project(id, tenantId, details, now, now, actorId, actorId, null);
    }

    public boolean isDeleted() { return deletedAt != null; }

    public Project update(ProjectDetails newDetails, UUID actorId, Instant now) {
        return change(newDetails, deletedAt, actorId, now);
    }

    public Project delete(UUID actorId, Instant now) { return change(details, now, actorId, now); }

    public Project restore(UUID actorId, Instant now) { return change(details, null, actorId, now); }

    private Project change(ProjectDetails newDetails, Instant newDeletedAt, UUID actorId, Instant now) {
        return new Project(id, tenantId, newDetails, createdAt, now, createdBy, actorId, newDeletedAt);
    }
}
