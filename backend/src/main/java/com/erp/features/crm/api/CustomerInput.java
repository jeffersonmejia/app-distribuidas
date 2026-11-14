package com.erp.features.crm.api;

//SOLID: SRP — ESTE CONTRATO CONTIENE LOS DATOS EDITABLES DE UN CLIENTE.
public record CustomerInput(String fullName, String cedula, String email, String phone) { }
