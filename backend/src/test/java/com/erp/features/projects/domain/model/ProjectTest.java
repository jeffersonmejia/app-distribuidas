package com.erp.features.projects.domain.model;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

//SOLID: SRP — ESTA SUITE COMPRUEBA LAS REGLAS DEL DOMINIO DE PROYECTOS.
class ProjectTest {
    private static final UUID ACTOR = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-11-14T10:00:00Z");

    @Test
    void nameIsRequiredAndOtherFieldsAreOptional() {
        assertThrows(IllegalArgumentException.class, () -> new ProjectDetails(null, null, null, null));
        assertThrows(IllegalArgumentException.class, () -> new ProjectDetails("  ", "x", null, null));
        ProjectDetails details = new ProjectDetails("  ERP  ", " ", null, null);
        assertEquals("ERP", details.name());
        assertNull(details.description());
    }

    @Test
    void endDateCannotPrecedeStartDate() {
        LocalDate start = LocalDate.of(2026, 11, 10);
        assertThrows(IllegalArgumentException.class,
                () -> new ProjectDetails("P", null, start, start.minusDays(1)));
        assertDoesNotThrow(() -> new ProjectDetails("P", null, start, start));
        assertDoesNotThrow(() -> new ProjectDetails("P", null, start, null));
        assertDoesNotThrow(() -> new ProjectDetails("P", null, null, start));
    }

    @Test
    void deleteAndRestoreAreLogicalAndTrackTheActor() {
        UUID other = UUID.randomUUID();
        Project project = Project.create(UUID.randomUUID(), UUID.randomUUID(),
                new ProjectDetails("P", null, null, null), ACTOR, NOW);
        assertFalse(project.isDeleted());
        Project deleted = project.delete(other, NOW.plusSeconds(1));
        assertTrue(deleted.isDeleted());
        assertEquals(other, deleted.updatedBy());
        assertEquals(ACTOR, deleted.createdBy());
        assertEquals(project.tenantId(), deleted.tenantId());
        assertFalse(deleted.restore(ACTOR, NOW.plusSeconds(2)).isDeleted());
    }
}
