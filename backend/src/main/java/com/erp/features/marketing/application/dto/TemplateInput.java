package com.erp.features.marketing.application.dto;

//SOLID: SRP — ESTE DTO CONTIENE EL CONTENIDO EDITABLE DE UNA PLANTILLA.
public record TemplateInput(String name, String subject, String htmlBody, String textBody) { }
