package com.erp.features.projects.domain.model;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

//SOLID: SRP — ESTA SUITE COMPRUEBA LAS REGLAS Y TRANSICIONES DEL DOMINIO DE TAREAS.
class TaskTest {
    private static final UUID ACTOR = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-11-14T10:00:00Z");

    private static Task newTask() {
        return Task.create(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                new TaskDetails("Diseñar", null, null, null, null), ACTOR, NOW);
    }

    private static Task in(TaskStatus status) {
        Task task = newTask();
        return switch (status) {
            case PENDING -> task;
            case IN_PROGRESS -> task.transitionTo(TaskStatus.IN_PROGRESS, ACTOR, NOW);
            case BLOCKED -> task.transitionTo(TaskStatus.BLOCKED, ACTOR, NOW);
            case COMPLETED -> task.transitionTo(TaskStatus.IN_PROGRESS, ACTOR, NOW)
                    .transitionTo(TaskStatus.COMPLETED, ACTOR, NOW);
        };
    }

    @Test
    void newTaskIsPendingWithOptionalFieldsEmpty() {
        Task task = newTask();
        assertEquals(TaskStatus.PENDING, task.status());
        assertNull(task.previousStatus());
        assertNull(task.details().priority());
        assertNull(task.details().assigneeId());
        assertNull(task.deletedAt());
    }

    @Test
    void titleIsRequiredAndTrimmed() {
        assertThrows(IllegalArgumentException.class, () -> new TaskDetails(null, null, null, null, null));
        assertThrows(IllegalArgumentException.class, () -> new TaskDetails("   ", null, null, null, null));
        TaskDetails details = new TaskDetails("  Tarea  ", "  ", null, TaskPriority.HIGH, LocalDate.of(2026, 12, 1));
        assertEquals("Tarea", details.title());
        assertNull(details.description());
    }

    @Test
    void approvedTransitionsFromPendingAndInProgress() {
        assertEquals(TaskStatus.IN_PROGRESS, in(TaskStatus.PENDING).transitionTo(TaskStatus.IN_PROGRESS, ACTOR, NOW).status());
        assertEquals(TaskStatus.BLOCKED, in(TaskStatus.PENDING).transitionTo(TaskStatus.BLOCKED, ACTOR, NOW).status());
        assertEquals(TaskStatus.PENDING, in(TaskStatus.IN_PROGRESS).transitionTo(TaskStatus.PENDING, ACTOR, NOW).status());
        assertEquals(TaskStatus.BLOCKED, in(TaskStatus.IN_PROGRESS).transitionTo(TaskStatus.BLOCKED, ACTOR, NOW).status());
        assertEquals(TaskStatus.COMPLETED, in(TaskStatus.IN_PROGRESS).transitionTo(TaskStatus.COMPLETED, ACTOR, NOW).status());
    }

    @Test
    void blockedReturnsOnlyToTheStateItHadBeforeBlocking() {
        Task fromPending = in(TaskStatus.BLOCKED);
        assertEquals(TaskStatus.PENDING, fromPending.previousStatus());
        assertThrows(IllegalStateException.class, () -> fromPending.transitionTo(TaskStatus.IN_PROGRESS, ACTOR, NOW));
        Task restored = fromPending.transitionTo(TaskStatus.PENDING, ACTOR, NOW);
        assertEquals(TaskStatus.PENDING, restored.status());
        assertNull(restored.previousStatus());

        Task fromProgress = in(TaskStatus.IN_PROGRESS).transitionTo(TaskStatus.BLOCKED, ACTOR, NOW);
        assertEquals(TaskStatus.IN_PROGRESS, fromProgress.previousStatus());
        assertThrows(IllegalStateException.class, () -> fromProgress.transitionTo(TaskStatus.PENDING, ACTOR, NOW));
        assertThrows(IllegalStateException.class, () -> fromProgress.transitionTo(TaskStatus.COMPLETED, ACTOR, NOW));
        assertEquals(TaskStatus.IN_PROGRESS, fromProgress.transitionTo(TaskStatus.IN_PROGRESS, ACTOR, NOW).status());
    }

    @Test
    void completedCanOnlyBeReopenedAsInProgress() {
        Task completed = in(TaskStatus.COMPLETED);
        assertEquals(TaskStatus.IN_PROGRESS, completed.transitionTo(TaskStatus.IN_PROGRESS, ACTOR, NOW).status());
        for (TaskStatus target : List.of(TaskStatus.PENDING, TaskStatus.BLOCKED, TaskStatus.COMPLETED)) {
            assertThrows(IllegalStateException.class, () -> completed.transitionTo(target, ACTOR, NOW));
        }
    }

    @Test
    void notApprovedTransitionsAreRejected() {
        assertThrows(IllegalStateException.class, () -> in(TaskStatus.PENDING).transitionTo(TaskStatus.COMPLETED, ACTOR, NOW));
        assertThrows(IllegalStateException.class, () -> in(TaskStatus.PENDING).transitionTo(TaskStatus.PENDING, ACTOR, NOW));
        assertThrows(IllegalStateException.class, () -> in(TaskStatus.IN_PROGRESS).transitionTo(TaskStatus.IN_PROGRESS, ACTOR, NOW));
        assertThrows(IllegalStateException.class, () -> in(TaskStatus.PENDING).transitionTo(null, ACTOR, NOW));
    }

    @Test
    void previousStatusIsConsistentWithBlockedState() {
        Task task = newTask();
        assertThrows(IllegalArgumentException.class, () -> new Task(task.id(), task.tenantId(), task.projectId(),
                task.details(), TaskStatus.BLOCKED, null, NOW, NOW, ACTOR, ACTOR, null));
        assertThrows(IllegalArgumentException.class, () -> new Task(task.id(), task.tenantId(), task.projectId(),
                task.details(), TaskStatus.PENDING, TaskStatus.PENDING, NOW, NOW, ACTOR, ACTOR, null));
    }

    @Test
    void deleteAndRestoreAreLogicalAndKeepStatusAndAudit() {
        UUID other = UUID.randomUUID();
        Instant later = NOW.plusSeconds(60);
        Task blocked = in(TaskStatus.BLOCKED);
        Task deleted = blocked.delete(other, later);
        assertTrue(deleted.isDeleted());
        assertEquals(TaskStatus.BLOCKED, deleted.status());
        assertEquals(TaskStatus.PENDING, deleted.previousStatus());
        assertEquals(other, deleted.updatedBy());
        assertEquals(ACTOR, deleted.createdBy());
        assertFalse(deleted.restore(ACTOR, later.plusSeconds(1)).isDeleted());
    }

    @Test
    void updateKeepsStatusAndTenantAndProject() {
        Task task = in(TaskStatus.IN_PROGRESS);
        Task updated = task.update(new TaskDetails("Nuevo", "d", null, TaskPriority.LOW, null), ACTOR, NOW.plusSeconds(5));
        assertEquals(TaskStatus.IN_PROGRESS, updated.status());
        assertEquals(task.tenantId(), updated.tenantId());
        assertEquals(task.projectId(), updated.projectId());
        assertEquals("Nuevo", updated.details().title());
    }
}
