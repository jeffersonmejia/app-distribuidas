package com.erp.features.marketing.application.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

//SOLID: SRP — ESTE DTO EXPONE LOS DATOS PÚBLICOS DE UNA CAMPAÑA.
public record CampaignView(UUID id, String name, String description, LocalDate startDate, LocalDate endDate,
                           String status, Instant createdAt, Instant updatedAt) { }
