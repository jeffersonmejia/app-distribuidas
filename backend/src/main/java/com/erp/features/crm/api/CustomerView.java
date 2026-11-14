package com.erp.features.crm.api;

import java.time.Instant;
import java.util.UUID;

//SOLID: SRP — ESTE CONTRATO EXPONE LOS DATOS PÚBLICOS DEL CLIENTE.
public record CustomerView(UUID id, String fullName, String cedula, String email, String phone,
                           String status, Instant createdAt, Instant updatedAt) { }
