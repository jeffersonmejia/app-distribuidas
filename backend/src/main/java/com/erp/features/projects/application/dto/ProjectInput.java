package com.erp.features.projects.application.dto;

import java.time.LocalDate;

//SOLID: SRP — ESTE DTO TRANSPORTA LOS DATOS DE ENTRADA DE UN PROYECTO.
public record ProjectInput(String name, String description, LocalDate startDate, LocalDate endDate) { }
