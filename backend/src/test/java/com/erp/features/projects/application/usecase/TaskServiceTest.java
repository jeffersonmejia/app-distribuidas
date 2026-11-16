package com.erp.features.projects.application.usecase;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import com.erp.features.identity.api.ActorId;
import com.erp.features.projects.application.dto.TaskInput;
import com.erp.features.projects.application.port.out.PageResult;
import com.erp.features.projects.application.port.out.ProjectStore;
import com.erp.features.projects.application.port.out.TaskStore;
import com.erp.features.projects.domain.model.Project;
import com.erp.features.projects.domain.model.ProjectDetails;
import com.erp.features.projects.domain.model.Task;
import com.erp.features.projects.domain.model.TaskDetails;
import com.erp.features.projects.domain.model.TaskPriority;
import com.erp.features.projects.domain.model.TaskStatus;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantContext;
import com.erp.features.tenancy.api.TenantId;
import com.erp.features.tenancy.api.TenantOperation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

//SOLID: SRP — ESTA SUITE COMPRUEBA LOS CASOS DE USO DE TAREAS, ESTADOS Y PERMISOS.
class TaskServiceTest {
    private final TenantAccess access = mock(TenantAccess.class);
    private final ProjectStore projects = mock(ProjectStore.class);
    private final TaskStore tasks = mock(TaskStore.class);
    private final TenantId tenant = new TenantId(UUID.randomUUID());
    private final ActorId actor = new ActorId(UUID.randomUUID());
    private final TaskService service = new TaskService(access, projects, tasks);
    private Project project;
    private Task task;

    @BeforeEach
    void setup() {
        when(access.execute(any(), anyString(), any())).thenAnswer(invocation -> {
            TenantOperation<?> operation = invocation.getArgument(2);
            return operation.apply(new TenantContext(invocation.getArgument(0), actor));
        });
        when(tasks.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        Instant now = Instant.parse("2026-11-01T00:00:00Z");
        project = Project.create(UUID.randomUUID(), tenant.value(), new ProjectDetails("P", null, null, null),
                actor.value(), now);
        task = Task.create(UUID.randomUUID(), tenant.value(), project.id(),
                new TaskDetails("Tarea", null, null, TaskPriority.MEDIUM, null), actor.value(), now);
        when(projects.find(tenant.value(), project.id())).thenReturn(Optional.of(project));
        when(tasks.find(tenant.value(), project.id(), task.id())).thenReturn(Optional.of(task));
    }

    @Test
    void createBelongsToOneActiveProjectAndStartsPending() {
        var view = service.create(tenant, project.id(), new TaskInput(" Nueva ", null, null, null, null));
        assertEquals("Nueva", view.title());
        assertEquals(project.id(), view.projectId());
        assertEquals(TaskStatus.PENDING, view.status());
        assertNull(view.priority());
        verify(access).execute(eq(tenant), eq("projects:tasks:create"), any());
    }

    @Test
    void createRejectsMissingTitleMissingProjectAndDeletedProject() {
        assertEquals("INVALID_TASK_DATA", assertThrows(ProjectsException.class,
                () -> service.create(tenant, project.id(), new TaskInput(" ", null, null, null, null))).code());
        UUID missing = UUID.randomUUID();
        assertEquals("PROJECT_NOT_FOUND", assertThrows(ProjectsException.class,
                () -> service.create(tenant, missing, new TaskInput("T", null, null, null, null))).code());
        when(projects.find(tenant.value(), project.id()))
                .thenReturn(Optional.of(project.delete(actor.value(), Instant.now())));
        assertEquals("PROJECT_NOT_FOUND", assertThrows(ProjectsException.class,
                () -> service.create(tenant, project.id(), new TaskInput("T", null, null, null, null))).code());
        verify(tasks, never()).save(any());
    }

    @Test
    void listEnforcesMaximumPageSizeOfFive() {
        assertThrows(ProjectsException.class, () -> service.list(tenant, project.id(), null, false, 0, 6));
        when(tasks.search(tenant.value(), project.id(), TaskStatus.PENDING, false, 0, 5))
                .thenReturn(new PageResult<>(List.of(task), false));
        assertEquals(1, service.list(tenant, project.id(), TaskStatus.PENDING, false, 0, 5).items().size());
        verify(access).execute(eq(tenant), eq("projects:tasks:read"), any());
    }

    @Test
    void getIgnoresTasksOfOtherProjectsOrDeleted() {
        UUID otherProject = UUID.randomUUID();
        when(projects.find(tenant.value(), otherProject)).thenReturn(Optional.of(
                Project.create(otherProject, tenant.value(), new ProjectDetails("O", null, null, null),
                        actor.value(), Instant.now())));
        when(tasks.find(tenant.value(), otherProject, task.id())).thenReturn(Optional.empty());
        assertEquals("TASK_NOT_FOUND", assertThrows(ProjectsException.class,
                () -> service.get(tenant, otherProject, task.id())).code());
        when(tasks.find(tenant.value(), project.id(), task.id()))
                .thenReturn(Optional.of(task.delete(actor.value(), Instant.now())));
        assertEquals("TASK_NOT_FOUND", assertThrows(ProjectsException.class,
                () -> service.get(tenant, project.id(), task.id())).code());
    }

    @Test
    void updateChangesPartialFieldsWithoutTouchingStatus() {
        Map<String, Object> patch = new HashMap<>();
        patch.put("priority", null);
        patch.put("description", "detalle");
        UUID assignee = UUID.randomUUID();
        patch.put("assigneeId", assignee);
        var view = service.update(tenant, project.id(), task.id(), patch);
        assertNull(view.priority());
        assertEquals("detalle", view.description());
        assertEquals(assignee, view.assigneeId());
        assertEquals(TaskStatus.PENDING, view.status());
        verify(access).execute(eq(tenant), eq("projects:tasks:update"), any());
    }

    @Test
    void statusChangeFollowsApprovedTransitionsAndReportsConflicts() {
        assertEquals(TaskStatus.IN_PROGRESS,
                service.changeStatus(tenant, project.id(), task.id(), TaskStatus.IN_PROGRESS).status());
        assertEquals("INVALID_TASK_TRANSITION", assertThrows(ProjectsException.class,
                () -> service.changeStatus(tenant, project.id(), task.id(), TaskStatus.COMPLETED)).code());
        assertEquals("INVALID_TASK_DATA", assertThrows(ProjectsException.class,
                () -> service.changeStatus(tenant, project.id(), task.id(), null)).code());
    }

    @Test
    void deleteRestoreAndPurgeUseSeparateExplicitPermissions() {
        service.delete(tenant, project.id(), task.id());
        verify(tasks).save(argThat(Task::isDeleted));
        Task deleted = task.delete(actor.value(), Instant.now());
        when(tasks.find(tenant.value(), project.id(), task.id())).thenReturn(Optional.of(deleted));
        assertFalse(service.restore(tenant, project.id(), task.id()).deletedAt() != null);
        service.purge(tenant, project.id(), task.id());
        verify(tasks).purge(tenant.value(), project.id(), task.id());
        verify(access, times(2)).execute(eq(tenant), eq("projects:tasks:delete"), any());
        verify(access).execute(eq(tenant), eq("projects:tasks:purge"), any());
    }

    @Test
    void purgeOnlyAppliesToLogicallyDeletedTasks() {
        assertEquals("DELETED_TASK_NOT_FOUND", assertThrows(ProjectsException.class,
                () -> service.purge(tenant, project.id(), task.id())).code());
        verify(tasks, never()).purge(any(), any(), any());
    }

    @Test
    void authorizationFailurePreventsAnyStorageAccess() {
        doThrow(new AccessDeniedException("denied")).when(access).execute(eq(tenant), anyString(), any());
        assertThrows(AccessDeniedException.class, () -> service.get(tenant, project.id(), task.id()));
        assertThrows(AccessDeniedException.class, () -> service.purge(tenant, project.id(), task.id()));
        assertThrows(AccessDeniedException.class,
                () -> service.create(tenant, project.id(), new TaskInput("T", null, null, null, null)));
        verifyNoInteractions(projects, tasks);
    }
}
