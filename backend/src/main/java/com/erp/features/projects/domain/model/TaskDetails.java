package com.erp.features.projects.domain.model;

import java.time.LocalDate;
import java.util.UUID;

//SOLID: SRP — ESTE VALOR VALIDA LOS DATOS EDITABLES DE UNA TAREA.
public record TaskDetails(String title, String description, UUID assigneeId, TaskPriority priority,
                          LocalDate dueDate) {
    public TaskDetails {
        title = title == null ? "" : title.trim();
        if (title.isEmpty()) { throw new IllegalArgumentException("task title is required"); }
        description = ProjectDetails.blankToNull(description);
    }
}
