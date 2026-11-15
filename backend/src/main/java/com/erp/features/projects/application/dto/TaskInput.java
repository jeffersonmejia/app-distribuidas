package com.erp.features.projects.application.dto;

import java.time.LocalDate;
import java.util.UUID;
import com.erp.features.projects.domain.model.TaskPriority;

//SOLID: SRP — ESTE DTO TRANSPORTA LOS DATOS DE ENTRADA DE UNA TAREA.
public record TaskInput(String title, String description, UUID assigneeId, TaskPriority priority,
                        LocalDate dueDate) { }
