package com.erp.features.inventory.api;

import java.util.UUID;

//SOLID: SRP — ESTE RECORD IDENTIFICA UNA TRANSICIÓN DE RESERVA.
public record ReservationCommand(String operationKey, UUID reservationId, String sourceReference) {}

