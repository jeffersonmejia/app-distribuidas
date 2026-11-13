package com.erp.features.inventory.api;

import java.util.List;
import java.util.UUID;

//SOLID: SRP — ESTE RECORD DESCRIBE EL ESTADO DE UNA RESERVA.
public record ReservationResult(
        UUID tenantId, UUID reservationId, String sourceReference,
        List<StockLine> lines, ReservationStatus status, UUID movementId) {}

