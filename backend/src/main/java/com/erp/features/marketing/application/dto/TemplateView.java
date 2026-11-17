package com.erp.features.marketing.application.dto;

import java.time.Instant;
import java.util.UUID;

//SOLID: SRP — ESTE DTO EXPONE LOS DATOS PÚBLICOS DE UNA PLANTILLA.
public record TemplateView(UUID id, String name, String subject, String htmlBody, String textBody,
                           Instant createdAt, Instant updatedAt) { }
