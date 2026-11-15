package com.erp.features.projects.application.usecase;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import com.erp.features.projects.application.dto.PageView;
import com.erp.features.projects.application.dto.TaskInput;
import com.erp.features.projects.application.dto.TaskView;
import com.erp.features.projects.application.port.out.PageResult;
import com.erp.features.projects.application.port.out.ProjectStore;
import com.erp.features.projects.application.port.out.TaskStore;
import com.erp.features.projects.domain.model.Task;
import com.erp.features.projects.domain.model.TaskDetails;
import com.erp.features.projects.domain.model.TaskPriority;
import com.erp.features.projects.domain.model.TaskStatus;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantContext;
import com.erp.features.tenancy.api.TenantId;
import org.springframework.stereotype.Service;

//SOLID: SRP — ESTE SERVICIO COORDINA LOS CASOS DE USO AUTORIZADOS DE TAREAS.
@Service
public class TaskService {
    static final String READ = "projects:tasks:read";
    static final String CREATE = "projects:tasks:create";
    static final String UPDATE = "projects:tasks:update";
    static final String DELETE = "projects:tasks:delete";
    static final String PURGE = "projects:tasks:purge";
    private final TenantAccess access;
    private final ProjectStore projects;
    private final TaskStore tasks;

    public TaskService(TenantAccess access, ProjectStore projects, TaskStore tasks) {
        this.access = access;
        this.projects = projects;
        this.tasks = tasks;
    }

    public TaskView create(TenantId tenant, UUID projectId, TaskInput input) {
        TaskDetails details = details(input);
        return access.execute(tenant, CREATE, context -> {
            requireActiveProject(context, projectId);
            return view(tasks.save(Task.create(UUID.randomUUID(), context.tenantId().value(), projectId, details,
                    context.actorId().value(), Instant.now())));
        });
    }

    public PageView<TaskView> list(TenantId tenant, UUID projectId, TaskStatus status, boolean deleted,
                                   int page, int size) {
        if (page < 0 || size < 1 || size > ProjectService.MAX_PAGE_SIZE) {
            throw new ProjectsException("INVALID_PAGE");
        }
        return access.execute(tenant, READ, context -> {
            requireActiveProject(context, projectId);
            PageResult<Task> result = tasks.search(context.tenantId().value(), projectId, status, deleted, page, size);
            return new PageView<>(result.items().stream().map(TaskService::view).toList(), page, size,
                    result.hasNext());
        });
    }

    public TaskView get(TenantId tenant, UUID projectId, UUID id) {
        return access.execute(tenant, READ, context -> view(find(context, projectId, id, false)));
    }

    /** Actualización parcial de datos; el estado solo cambia mediante {@link #changeStatus}. */
    public TaskView update(TenantId tenant, UUID projectId, UUID id, Map<String, Object> fields) {
        return access.execute(tenant, UPDATE, context -> {
            Task task = find(context, projectId, id, false);
            TaskDetails old = task.details();
            TaskDetails updated = details(new TaskInput(
                    (String) fields.getOrDefault("title", old.title()),
                    (String) fields.getOrDefault("description", old.description()),
                    (UUID) fields.getOrDefault("assigneeId", old.assigneeId()),
                    (TaskPriority) fields.getOrDefault("priority", old.priority()),
                    (LocalDate) fields.getOrDefault("dueDate", old.dueDate())));
            return view(tasks.save(task.update(updated, context.actorId().value(), Instant.now())));
        });
    }

    public TaskView changeStatus(TenantId tenant, UUID projectId, UUID id, TaskStatus target) {
        if (target == null) { throw new ProjectsException("INVALID_TASK_DATA"); }
        return access.execute(tenant, UPDATE, context -> {
            Task task = find(context, projectId, id, false);
            try {
                return view(tasks.save(task.transitionTo(target, context.actorId().value(), Instant.now())));
            } catch (IllegalStateException exception) {
                throw new ProjectsException("INVALID_TASK_TRANSITION");
            }
        });
    }

    public void delete(TenantId tenant, UUID projectId, UUID id) {
        access.execute(tenant, DELETE, context -> {
            tasks.save(find(context, projectId, id, false).delete(context.actorId().value(), Instant.now()));
            return null;
        });
    }

    public TaskView restore(TenantId tenant, UUID projectId, UUID id) {
        return access.execute(tenant, DELETE, context -> view(tasks.save(
                find(context, projectId, id, true).restore(context.actorId().value(), Instant.now()))));
    }

    /** Purga manual y permanente: solo tareas ya borradas lógicamente. */
    public void purge(TenantId tenant, UUID projectId, UUID id) {
        access.execute(tenant, PURGE, context -> {
            Task task = find(context, projectId, id, true);
            tasks.purge(task.tenantId(), task.projectId(), task.id());
            return null;
        });
    }

    private void requireActiveProject(TenantContext context, UUID projectId) {
        projects.find(context.tenantId().value(), projectId).filter(project -> !project.isDeleted())
                .orElseThrow(() -> new ProjectsException("PROJECT_NOT_FOUND"));
    }

    private Task find(TenantContext context, UUID projectId, UUID id, boolean deleted) {
        requireActiveProject(context, projectId);
        return tasks.find(context.tenantId().value(), projectId, id)
                .filter(task -> task.isDeleted() == deleted)
                .orElseThrow(() -> new ProjectsException(deleted ? "DELETED_TASK_NOT_FOUND" : "TASK_NOT_FOUND"));
    }

    private static TaskDetails details(TaskInput input) {
        if (input == null) { throw new ProjectsException("INVALID_TASK_DATA"); }
        try {
            return new TaskDetails(input.title(), input.description(), input.assigneeId(), input.priority(),
                    input.dueDate());
        } catch (IllegalArgumentException exception) {
            throw new ProjectsException("INVALID_TASK_DATA");
        }
    }

    private static TaskView view(Task task) {
        TaskDetails d = task.details();
        return new TaskView(task.id(), task.projectId(), d.title(), d.description(), d.assigneeId(), d.priority(),
                d.dueDate(), task.status(), task.createdAt(), task.updatedAt(), task.deletedAt());
    }
}
