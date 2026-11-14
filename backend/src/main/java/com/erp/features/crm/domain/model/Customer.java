package com.erp.features.crm.domain.model;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

//SOLID: SRP — ESTE MODELO PROTEGE EL ESTADO Y LA AUDITORÍA DEL CLIENTE.
public record Customer(UUID id, UUID tenantId, CustomerDetails details, CustomerStatus status,
                       Instant createdAt, Instant updatedAt, UUID createdBy, UUID updatedBy, Instant deletedAt) {
    public Customer {
        Objects.requireNonNull(id);
        Objects.requireNonNull(tenantId);
        Objects.requireNonNull(details);
        Objects.requireNonNull(status);
        Objects.requireNonNull(createdAt);
        Objects.requireNonNull(updatedAt);
        Objects.requireNonNull(createdBy);
        Objects.requireNonNull(updatedBy);
    }

    public static Customer create(UUID id, UUID tenantId, CustomerDetails details, UUID actorId, Instant now) {
        return new Customer(id, tenantId, details, CustomerStatus.ACTIVE, now, now, actorId, actorId, null);
    }

    public Customer update(CustomerDetails newDetails, UUID actorId, Instant now) {
        return change(newDetails, status, deletedAt, actorId, now);
    }

    public Customer changeStatus(CustomerStatus newStatus, UUID actorId, Instant now) {
        return change(details, newStatus, deletedAt, actorId, now);
    }

    public Customer archive(UUID actorId, Instant now) {
        return change(details, status, now, actorId, now);
    }

    public Customer restore(UUID actorId, Instant now) {
        return change(details, status, null, actorId, now);
    }

    private Customer change(CustomerDetails newDetails, CustomerStatus newStatus, Instant newDeletedAt,
                            UUID actorId, Instant now) {
        return new Customer(id, tenantId, newDetails, newStatus, createdAt, now, createdBy, actorId, newDeletedAt);
    }
}
