package com.erp.features.projects.domain.model;

import java.time.LocalDate;

//SOLID: SRP — ESTE VALOR VALIDA LOS DATOS EDITABLES DE UN PROYECTO.
public record ProjectDetails(String name, String description, LocalDate startDate, LocalDate endDate) {
    public ProjectDetails {
        name = name == null ? "" : name.trim();
        if (name.isEmpty()) { throw new IllegalArgumentException("project name is required"); }
        description = blankToNull(description);
        if (startDate != null && endDate != null && endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("end date must not precede start date");
        }
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
