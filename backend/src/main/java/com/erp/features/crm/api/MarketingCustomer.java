package com.erp.features.crm.api;

import java.util.UUID;

//SOLID: ISP — ESTE CONTRATO EXPONE SOLO LOS DATOS ACORDADOS PARA MARKETING.
public record MarketingCustomer(UUID id, String fullName, String email, String phone) { }
