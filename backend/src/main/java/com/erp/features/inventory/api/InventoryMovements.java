package com.erp.features.inventory.api;

import java.util.UUID;

/**
 * Contrato interno entre módulos. tenantId y actorId deben proceder del contexto
 * validado por tenancy, nunca de un payload usado como prueba de autorización.
 * Ver docs/inventory-movements.md. No define transporte ni implementación.
 */
//SOLID: ISP — ESTA INTERFAZ EXPONE LAS OPERACIONES DE MOVIMIENTOS Y RESERVAS.
public interface InventoryMovements {
    InventoryResult<MovementResult> receive(
            UUID tenantId, UUID actorId, ReceiveStockCommand command);

    InventoryResult<MovementResult> issue(
            UUID tenantId, UUID actorId, IssueStockCommand command);

    InventoryResult<ReservationResult> reserve(
            UUID tenantId, UUID actorId, ReserveStockCommand command);

    InventoryResult<ReservationResult> confirmReservation(
            UUID tenantId, UUID actorId, ReservationCommand command);

    InventoryResult<ReservationResult> releaseReservation(
            UUID tenantId, UUID actorId, ReservationCommand command);

    InventoryResult<ReservationResult> getReservation(
            UUID tenantId, UUID actorId, UUID reservationId);
}

