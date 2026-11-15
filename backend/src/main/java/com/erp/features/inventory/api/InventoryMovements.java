package com.erp.features.inventory.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import com.erp.features.tenancy.api.TenantId;

//SOLID: ISP — ESTA API PUBLICA SOLO MOVIMIENTOS Y CONSULTAS DE INVENTARIO.
public interface InventoryMovements {
    enum Type { RECEIPT, ISSUE, RESERVE, CONFIRM, RELEASE }
    enum Status { ACTIVE, CONFIRMED, RELEASED }

    //SOLID: SRP — ESTE RECORD TRANSPORTA UNA CANTIDAD Y SU UNIDAD EXPLÍCITA.
    record Line(UUID productId, String unit, BigDecimal quantity) {}

    //SOLID: SRP — ESTE RECORD TRANSPORTA UNA INTENCIÓN DE MOVIMIENTO.
    record StockCommand(String operationKey, String sourceReference, List<Line> lines) {
        public StockCommand {
            if (lines != null) { lines = java.util.Collections.unmodifiableList(new java.util.ArrayList<>(lines)); }
        }
    }

    //SOLID: SRP — ESTE RECORD IDENTIFICA UNA TRANSICIÓN DE RESERVA.
    record ReservationCommand(String operationKey, String sourceReference, UUID reservationId) {}

    //SOLID: SRP — ESTE RECORD EXPONE EL RESULTADO INMUTABLE DE UNA OPERACIÓN.
    record Operation(UUID id, UUID tenantId, UUID actorId, Type type, String sourceReference,
                     UUID reservationId, List<Line> lines, Instant occurredAt) {
        public Operation { lines = List.copyOf(lines); }
    }

    //SOLID: SRP — ESTE RECORD EXPONE EXISTENCIA, RESERVA Y DISPONIBILIDAD.
    record Availability(UUID productId, String unit, BigDecimal onHand, BigDecimal reserved,
                        BigDecimal available) {}

    //SOLID: SRP — ESTE RECORD EXPONE EL ESTADO ACTUAL DE UNA RESERVA.
    record Reservation(Operation operation, Status status, UUID confirmationId) {}

    Operation receive(TenantId tenant, StockCommand command);
    Operation issue(TenantId tenant, StockCommand command);
    Operation reserve(TenantId tenant, StockCommand command);
    Operation confirmReservation(TenantId tenant, ReservationCommand command);
    Operation releaseReservation(TenantId tenant, ReservationCommand command);
    Availability availability(TenantId tenant, UUID productId);
    Reservation reservation(TenantId tenant, UUID reservationId);

    /**
     * Ejecuta el descuento y el trabajo del consumidor en una misma transacción.
     * El callback debe usar la misma base de datos/transaction manager, sin REQUIRES_NEW.
     * También se invoca al reintentar: el consumidor debe ser idempotente con la referencia.
     */
    <T> T issueAndExecute(TenantId tenant, StockCommand command, Function<Operation, T> work);
    <T> T confirmAndExecute(TenantId tenant, ReservationCommand command, Function<Operation, T> work);
}

