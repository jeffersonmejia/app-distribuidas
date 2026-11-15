package com.erp.features.projects.application.usecase;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import com.erp.features.identity.api.ActorId;
import com.erp.features.projects.application.dto.ProjectInput;
import com.erp.features.projects.application.port.out.PageResult;
import com.erp.features.projects.application.port.out.ProjectStore;
import com.erp.features.projects.application.port.out.TaskStore;
import com.erp.features.projects.domain.model.Project;
import com.erp.features.projects.domain.model.ProjectDetails;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantContext;
import com.erp.features.tenancy.api.TenantId;
import com.erp.features.tenancy.api.TenantOperation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

//SOLID: SRP — ESTA SUITE COMPRUEBA LOS CASOS DE USO DE PROYECTOS Y SUS PERMISOS.
class ProjectServiceTest {
    private final TenantAccess access = mock(TenantAccess.class);
    private final ProjectStore projects = mock(ProjectStore.class);
    private final TaskStore tasks = mock(TaskStore.class);
    private final TenantId tenant = new TenantId(UUID.randomUUID());
    private final ActorId actor = new ActorId(UUID.randomUUID());
    private final ProjectService service = new ProjectService(access, projects, tasks);
    private Project project;

    @BeforeEach
    void setup() {
        when(access.execute(any(), anyString(), any())).thenAnswer(invocation -> {
            TenantOperation<?> operation = invocation.getArgument(2);
            return operation.apply(new TenantContext(invocation.getArgument(0), actor));
        });
        when(projects.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        project = Project.create(UUID.randomUUID(), tenant.value(),
                new ProjectDetails("ERP", "desc", LocalDate.of(2026, 11, 1), null), actor.value(),
                Instant.parse("2026-11-01T00:00:00Z"));
    }

    @Test
    void createUsesCreatePermissionAndAuthorizedTenant() {
        var view = service.create(tenant, new ProjectInput("  Nuevo ", null, null, null));
        assertEquals("Nuevo", view.name());
        assertNull(view.deletedAt());
        verify(access).execute(eq(tenant), eq("projects:projects:create"), any());
        verify(projects).save(argThat(saved -> saved.tenantId().equals(tenant.value())
                && saved.createdBy().equals(actor.value())));
    }

    @Test
    void invalidDataIsRejectedBeforeAuthorizationOrStorage() {
        assertEquals("INVALID_PROJECT_DATA", assertThrows(ProjectsException.class,
                () -> service.create(tenant, new ProjectInput(" ", null, null, null))).code());
        assertEquals("INVALID_PROJECT_DATA", assertThrows(ProjectsException.class,
                () -> service.create(tenant, null)).code());
        assertEquals("INVALID_PROJECT_DATA", assertThrows(ProjectsException.class, () -> service.create(tenant,
                new ProjectInput("P", null, LocalDate.of(2026, 2, 2), LocalDate.of(2026, 2, 1)))).code());
        verifyNoInteractions(projects);
    }

    @Test
    void listEnforcesMaximumPageSizeOfFiveAndNormalizesSearch() {
        for (int size : new int[]{0, 6, 100}) {
            assertEquals("INVALID_PAGE", assertThrows(ProjectsException.class,
                    () -> service.list(tenant, null, false, 0, size)).code());
        }
        assertThrows(ProjectsException.class, () -> service.list(tenant, null, false, -1, 5));
        when(projects.search(tenant.value(), "erp", false, 0, 5)).thenReturn(new PageResult<>(List.of(project), true));
        var page = service.list(tenant, "  ERP ", false, 0, 5);
        assertEquals(1, page.items().size());
        assertTrue(page.hasNext());
        verify(access).execute(eq(tenant), eq("projects:projects:read"), any());
    }

    @Test
    void getHidesDeletedAndMissingProjectsAsNotFound() {
        when(projects.find(tenant.value(), project.id())).thenReturn(Optional.empty());
        assertEquals("PROJECT_NOT_FOUND", assertThrows(ProjectsException.class,
                () -> service.get(tenant, project.id())).code());
        when(projects.find(tenant.value(), project.id()))
                .thenReturn(Optional.of(project.delete(actor.value(), Instant.now())));
        assertEquals("PROJECT_NOT_FOUND", assertThrows(ProjectsException.class,
                () -> service.get(tenant, project.id())).code());
    }

    @Test
    void updateChangesOnlyProvidedFieldsAndAllowsClearingOptionals() {
        when(projects.find(tenant.value(), project.id())).thenReturn(Optional.of(project));
        Map<String, Object> patch = new HashMap<>();
        patch.put("description", null);
        patch.put("name", "Renombrado");
        var view = service.update(tenant, project.id(), patch);
        assertEquals("Renombrado", view.name());
        assertNull(view.description());
        assertEquals(LocalDate.of(2026, 11, 1), view.startDate());
        verify(access).execute(eq(tenant), eq("projects:projects:update"), any());
        Map<String, Object> blank = new HashMap<>();
        blank.put("name", null);
        assertEquals("INVALID_PROJECT_DATA", assertThrows(ProjectsException.class,
                () -> service.update(tenant, project.id(), blank)).code());
    }

    @Test
    void deleteAndRestoreAreLogicalAndUseDeletePermission() {
        when(projects.find(tenant.value(), project.id())).thenReturn(Optional.of(project));
        service.delete(tenant, project.id());
        verify(projects).save(argThat(Project::isDeleted));
        Project deleted = project.delete(actor.value(), Instant.now());
        when(projects.find(tenant.value(), project.id())).thenReturn(Optional.of(deleted));
        assertNull(service.restore(tenant, project.id()).deletedAt());
        verify(access, times(2)).execute(eq(tenant), eq("projects:projects:delete"), any());
        verify(projects, never()).purge(any(), any());
    }

    @Test
    void restoreRequiresADeletedProject() {
        when(projects.find(tenant.value(), project.id())).thenReturn(Optional.of(project));
        assertEquals("DELETED_PROJECT_NOT_FOUND", assertThrows(ProjectsException.class,
                () -> service.restore(tenant, project.id())).code());
    }

    @Test
    void purgeNeedsExplicitPermissionAndAnAlreadyDeletedProject() {
        when(projects.find(tenant.value(), project.id())).thenReturn(Optional.of(project));
        assertEquals("DELETED_PROJECT_NOT_FOUND", assertThrows(ProjectsException.class,
                () -> service.purge(tenant, project.id())).code());
        verify(projects, never()).purge(any(), any());

        when(projects.find(tenant.value(), project.id()))
                .thenReturn(Optional.of(project.delete(actor.value(), Instant.now())));
        service.purge(tenant, project.id());
        var order = inOrder(tasks, projects);
        order.verify(tasks).purgeAllOfProject(tenant.value(), project.id());
        order.verify(projects).purge(tenant.value(), project.id());
        verify(access, atLeastOnce()).execute(eq(tenant), eq("projects:projects:purge"), any());
    }

    @Test
    void authorizationFailurePreventsAnyStorageAccess() {
        doThrow(new AccessDeniedException("denied")).when(access).execute(eq(tenant), anyString(), any());
        assertThrows(AccessDeniedException.class, () -> service.get(tenant, project.id()));
        assertThrows(AccessDeniedException.class, () -> service.purge(tenant, project.id()));
        assertThrows(AccessDeniedException.class, () -> service.delete(tenant, project.id()));
        verifyNoInteractions(projects, tasks);
    }
}
