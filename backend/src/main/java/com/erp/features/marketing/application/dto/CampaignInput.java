package com.erp.features.marketing.application.dto;

import java.time.LocalDate;

//SOLID: SRP — ESTE DTO CONTIENE LOS DATOS OBLIGATORIOS DE UNA CAMPAÑA.
public record CampaignInput(String name, String description, LocalDate startDate, LocalDate endDate) { }
