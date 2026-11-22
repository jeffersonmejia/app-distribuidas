package com.erp.features.marketing.application.dto;

//SOLID: SRP — ESTE DTO RESUME EL RESULTADO DE UN ENVÍO MANUAL.
public record SendResult(int sent, int failed, long remainingToday) { }
