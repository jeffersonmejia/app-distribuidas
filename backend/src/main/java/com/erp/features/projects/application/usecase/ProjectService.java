package com.erp.features.projects.application.usecase;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import com.erp.features.projects.application.dto.PageView;
import com.erp.features.projects.application.dto.ProjectInput;
import com.erp.features.projects.application.dto.ProjectView;
import com.erp.features.projects.application.port.out.PageResult;
import com.erp.features.projects.application.port.out.ProjectStore;
import com.erp.features.projects.application.port.out.TaskStore;
import com.erp.features.projects.domain.model.Project;
import com.erp.features.projects.domain.model.ProjectDetails;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantContext;
import com.erp.features.tenancy.api.TenantId;
import org.springframework.stereotype.Service;

//SOLID: SRP — ESTE SERVICIO COORDINA LOS CASOS DE USO AUTORIZADOS DE PROYECTOS.
@Service
public class ProjectService {
    static final String READ = "projects:projects:read";
    static final String CREATE = "projects:projects:create";
    static final String UPDATE = "projects:projects:update";
    static final String DELETE = "projects:projects:delete";
    static final String PURGE = "projects:projects:purge";
    static final int MAX_PAGE_SIZE = 5;
    private final TenantAccess access;
    private final ProjectStore projects;
    private final TaskStore tasks;

    public ProjectService(TenantAccess access, ProjectStore projects, TaskStore tasks) {
        this.access = access;
        this.projects = projects;
        this.tasks = tasks;
    }

    public ProjectView create(TenantId tenant, ProjectInput input) {
        ProjectDetails details = details(input);
        return access.execute(tenant, CREATE, context -> view(projects.save(Project.create(
                UUID.randomUUID(), context.tenantId().value(), details, context.actorId().value(), Instant.now()))));
    }

    public PageView<ProjectView> list(TenantId tenant, String search, boolean deleted, int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) { throw new ProjectsException("INVALID_PAGE"); }
        String term = search == null || search.isBlank() ? null : search.trim().toLowerCase(Locale.ROOT);
        return access.execute(tenant, READ, context -> {
            PageResult<Project> result = projects.search(context.tenantId().value(), term, deleted, page, size);
            return new PageView<>(result.items().stream().map(ProjectService::view).toList(), page, size,
                    result.hasNext());
        });
    }

    public ProjectView get(TenantId tenant, UUID id) {
        return access.execute(tenant, READ, context -> view(find(context, id, false)));
    }

    /** Actualización parcial: solo cambian las claves presentes; un valor null borra el campo opcional. */
    public ProjectView update(TenantId tenant, UUID id, Map<String, Object> fields) {
        return access.execute(tenant, UPDATE, context -> {
            Project project = find(context, id, false);
            ProjectDetails old = project.details();
            ProjectDetails updated = details(new ProjectInput(
                    (String) fields.getOrDefault("name", old.name()),
                    (String) fields.getOrDefault("description", old.description()),
                    (LocalDate) fields.getOrDefault("startDate", old.startDate()),
                    (LocalDate) fields.getOrDefault("endDate", old.endDate())));
            return view(projects.save(project.update(updated, context.actorId().value(), Instant.now())));
        });
    }

    public void delete(TenantId tenant, UUID id) {
        access.execute(tenant, DELETE, context -> {
            projects.save(find(context, id, false).delete(context.actorId().value(), Instant.now()));
            return null;
        });
    }

    public ProjectView restore(TenantId tenant, UUID id) {
        return access.execute(tenant, DELETE, context -> view(projects.save(
                find(context, id, true).restore(context.actorId().value(), Instant.now()))));
    }

    /** Purga manual y permanente: solo proyectos ya borrados lógicamente; elimina también sus tareas. */
    public void purge(TenantId tenant, UUID id) {
        access.execute(tenant, PURGE, context -> {
            Project project = find(context, id, true);
            tasks.purgeAllOfProject(project.tenantId(), project.id());
            projects.purge(project.tenantId(), project.id());
            return null;
        });
    }

    private Project find(TenantContext context, UUID id, boolean deleted) {
        return projects.find(context.tenantId().value(), id)
                .filter(project -> project.isDeleted() == deleted)
                .orElseThrow(() -> new ProjectsException(deleted ? "DELETED_PROJECT_NOT_FOUND" : "PROJECT_NOT_FOUND"));
    }

    private static ProjectDetails details(ProjectInput input) {
        if (input == null) { throw new ProjectsException("INVALID_PROJECT_DATA"); }
        try {
            return new ProjectDetails(input.name(), input.description(), input.startDate(), input.endDate());
        } catch (IllegalArgumentException exception) {
            throw new ProjectsException("INVALID_PROJECT_DATA");
        }
    }

    private static ProjectView view(Project project) {
        ProjectDetails d = project.details();
        return new ProjectView(project.id(), d.name(), d.description(), d.startDate(), d.endDate(),
                project.createdAt(), project.updatedAt(), project.deletedAt());
    }
}
