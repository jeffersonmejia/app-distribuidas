package com.erp.features.marketing.application.dto;

import java.util.UUID;

//SOLID: SRP — ESTE DTO EXPONE UN CONTACTO DE CRM CON SU PREFERENCIA (CONSENTED, UNSUBSCRIBED O NONE).
public record ContactView(UUID customerId, String fullName, String email, String consent) { }
