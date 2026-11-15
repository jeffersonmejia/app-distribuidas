package com.erp.features.projects.application.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

//SOLID: SRP — ESTE DTO EXPONE UN PROYECTO SIN ENTIDADES DE PERSISTENCIA.
public record ProjectView(UUID id, String name, String description, LocalDate startDate, LocalDate endDate,
                          Instant createdAt, Instant updatedAt, Instant deletedAt) { }
