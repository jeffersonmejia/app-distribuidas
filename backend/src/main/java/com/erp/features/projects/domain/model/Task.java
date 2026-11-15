package com.erp.features.projects.domain.model;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

//SOLID: SRP — ESTE MODELO PROTEGE LAS TRANSICIONES Y LA AUDITORÍA DE LA TAREA.
public record Task(UUID id, UUID tenantId, UUID projectId, TaskDetails details, TaskStatus status,
                   TaskStatus previousStatus, Instant createdAt, Instant updatedAt, UUID createdBy,
                   UUID updatedBy, Instant deletedAt) {
    public Task {
        Objects.requireNonNull(id);
        Objects.requireNonNull(tenantId);
        Objects.requireNonNull(projectId);
        Objects.requireNonNull(details);
        Objects.requireNonNull(status);
        Objects.requireNonNull(createdAt);
        Objects.requireNonNull(updatedAt);
        Objects.requireNonNull(createdBy);
        Objects.requireNonNull(updatedBy);
        if ((status == TaskStatus.BLOCKED) != (previousStatus != null)) {
            throw new IllegalArgumentException("previous status is required only while blocked");
        }
        if (previousStatus != null && previousStatus != TaskStatus.PENDING
                && previousStatus != TaskStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("a task can only be blocked from pending or in progress");
        }
    }

    public static Task create(UUID id, UUID tenantId, UUID projectId, TaskDetails details, UUID actorId,
                              Instant now) {
        return new Task(id, tenantId, projectId, details, TaskStatus.PENDING, null, now, now, actorId, actorId, null);
    }

    public boolean isDeleted() { return deletedAt != null; }

    /**
     * Aplica una transición aprobada: Pendiente→En progreso/Bloqueada; En progreso→Pendiente/Bloqueada/Completada;
     * Bloqueada→estado previo al bloqueo; Completada→En progreso.
     *
     * @throws IllegalStateException si la transición no está permitida
     */
    public Task transitionTo(TaskStatus target, UUID actorId, Instant now) {
        if (target == null || !canTransitionTo(target)) {
            throw new IllegalStateException("transition not allowed");
        }
        TaskStatus newPrevious = target == TaskStatus.BLOCKED ? status : null;
        return new Task(id, tenantId, projectId, details, target, newPrevious, createdAt, now, createdBy,
                actorId, deletedAt);
    }

    private boolean canTransitionTo(TaskStatus target) {
        return switch (status) {
            case PENDING -> target == TaskStatus.IN_PROGRESS || target == TaskStatus.BLOCKED;
            case IN_PROGRESS -> target == TaskStatus.PENDING || target == TaskStatus.BLOCKED
                    || target == TaskStatus.COMPLETED;
            case BLOCKED -> target == previousStatus;
            case COMPLETED -> target == TaskStatus.IN_PROGRESS;
        };
    }

    public Task update(TaskDetails newDetails, UUID actorId, Instant now) {
        return new Task(id, tenantId, projectId, newDetails, status, previousStatus, createdAt, now, createdBy,
                actorId, deletedAt);
    }

    public Task delete(UUID actorId, Instant now) {
        return new Task(id, tenantId, projectId, details, status, previousStatus, createdAt, now, createdBy,
                actorId, now);
    }

    public Task restore(UUID actorId, Instant now) {
        return new Task(id, tenantId, projectId, details, status, previousStatus, createdAt, now, createdBy,
                actorId, null);
    }
}
