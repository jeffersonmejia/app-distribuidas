package com.erp.features.inventory.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

//SOLID: SRP — ESTE RECORD DESCRIBE UN MOVIMIENTO REGISTRADO.
public record MovementResult(
        UUID tenantId, UUID movementId, String sourceReference, MovementType type,
        List<StockLine> lines, Instant occurredAt, UUID actorId) {}

