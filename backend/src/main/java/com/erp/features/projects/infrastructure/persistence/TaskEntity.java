package com.erp.features.projects.infrastructure.persistence;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import com.erp.features.projects.domain.model.Task;
import com.erp.features.projects.domain.model.TaskDetails;
import com.erp.features.projects.domain.model.TaskPriority;
import com.erp.features.projects.domain.model.TaskStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

//SOLID: SRP — ESTA ENTIDAD REPRESENTA LA PERSISTENCIA DE UNA TAREA.
@Entity
@Table(name = "projects_task")
public class TaskEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(name = "project_id", nullable = false, updatable = false) UUID projectId;
    @Column(nullable = false, columnDefinition = "text") String title;
    @Column(columnDefinition = "text") String description;
    @Column(name = "assignee_id") UUID assigneeId;
    @Enumerated(EnumType.STRING) @Column(length = 16) TaskPriority priority;
    @Column(name = "due_date") LocalDate dueDate;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) TaskStatus status;
    @Enumerated(EnumType.STRING) @Column(name = "previous_status", length = 16) TaskStatus previousStatus;
    @Column(name = "created_at", nullable = false, updatable = false) Instant createdAt;
    @Column(name = "updated_at", nullable = false) Instant updatedAt;
    @Column(name = "created_by", nullable = false, updatable = false) UUID createdBy;
    @Column(name = "updated_by", nullable = false) UUID updatedBy;
    @Column(name = "deleted_at") Instant deletedAt;

    protected TaskEntity() { }

    TaskEntity(Task task) { apply(task); }

    void apply(Task task) {
        id = task.id();
        tenantId = task.tenantId();
        projectId = task.projectId();
        title = task.details().title();
        description = task.details().description();
        assigneeId = task.details().assigneeId();
        priority = task.details().priority();
        dueDate = task.details().dueDate();
        status = task.status();
        previousStatus = task.previousStatus();
        createdAt = task.createdAt();
        updatedAt = task.updatedAt();
        createdBy = task.createdBy();
        updatedBy = task.updatedBy();
        deletedAt = task.deletedAt();
    }

    Task toDomain() {
        return new Task(id, tenantId, projectId, new TaskDetails(title, description, assigneeId, priority, dueDate),
                status, previousStatus, createdAt, updatedAt, createdBy, updatedBy, deletedAt);
    }
}
