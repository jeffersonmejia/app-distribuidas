package com.erp.features.projects.application.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import com.erp.features.projects.domain.model.TaskPriority;
import com.erp.features.projects.domain.model.TaskStatus;

//SOLID: SRP — ESTE DTO EXPONE UNA TAREA SIN ENTIDADES DE PERSISTENCIA.
public record TaskView(UUID id, UUID projectId, String title, String description, UUID assigneeId,
                       TaskPriority priority, LocalDate dueDate, TaskStatus status, Instant createdAt,
                       Instant updatedAt, Instant deletedAt) { }
