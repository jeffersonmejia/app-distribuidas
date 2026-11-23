package com.erp.features.projects.infrastructure.persistence;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import com.erp.features.projects.domain.model.Project;
import com.erp.features.projects.domain.model.ProjectDetails;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

//SOLID: SRP — ESTA ENTIDAD REPRESENTA LA PERSISTENCIA DE UN PROYECTO.
@Entity
@Table(name = "projects_project")
@org.hibernate.annotations.Check(constraints = "char_length(name) <= 150 AND char_length(description) <= 2000")
public class ProjectEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(nullable = false, columnDefinition = "text") String name;
    @Column(columnDefinition = "text") String description;
    @Column(name = "start_date") LocalDate startDate;
    @Column(name = "end_date") LocalDate endDate;
    @Column(name = "created_at", nullable = false, updatable = false) Instant createdAt;
    @Column(name = "updated_at", nullable = false) Instant updatedAt;
    @Column(name = "created_by", nullable = false, updatable = false) UUID createdBy;
    @Column(name = "updated_by", nullable = false) UUID updatedBy;
    @Column(name = "deleted_at") Instant deletedAt;

    protected ProjectEntity() { }

    ProjectEntity(Project project) { apply(project); }

    void apply(Project project) {
        id = project.id();
        tenantId = project.tenantId();
        name = project.details().name();
        description = project.details().description();
        startDate = project.details().startDate();
        endDate = project.details().endDate();
        createdAt = project.createdAt();
        updatedAt = project.updatedAt();
        createdBy = project.createdBy();
        updatedBy = project.updatedBy();
        deletedAt = project.deletedAt();
    }

    Project toDomain() {
        return new Project(id, tenantId, new ProjectDetails(name, description, startDate, endDate),
                createdAt, updatedAt, createdBy, updatedBy, deletedAt);
    }
}
