package com.erp.features.inventory.domain.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import static com.erp.features.inventory.domain.model.InventoryException.Code.*;

//SOLID: SRP — ESTE MODELO PROTEGE LAS INVARIANTES DEL SALDO DE UN PRODUCTO.
public record Stock(UUID id, UUID tenantId, UUID productId, String unit,
                    BigDecimal onHand, BigDecimal reserved,
                    Instant createdAt, UUID createdBy, Instant updatedAt, UUID updatedBy) {
    public Stock {
        if (id == null || tenantId == null || productId == null || unit == null || unit.isBlank()
                || onHand == null || reserved == null || createdAt == null || createdBy == null
                || updatedAt == null || updatedBy == null || onHand.signum() < 0
                || reserved.signum() < 0 || reserved.compareTo(onHand) > 0) {
            throw new InventoryException(INVALID_REQUEST);
        }
    }

    public BigDecimal available() { return onHand.subtract(reserved); }

    public Stock receive(BigDecimal quantity, UUID actor, Instant now) {
        positive(quantity);
        return change(onHand.add(quantity), reserved, actor, now);
    }

    public Stock issue(BigDecimal quantity, UUID actor, Instant now) {
        requireAvailable(quantity);
        return change(onHand.subtract(quantity), reserved, actor, now);
    }

    public Stock reserve(BigDecimal quantity, UUID actor, Instant now) {
        requireAvailable(quantity);
        return change(onHand, reserved.add(quantity), actor, now);
    }

    public Stock confirm(BigDecimal quantity, UUID actor, Instant now) {
        requireReserved(quantity);
        return change(onHand.subtract(quantity), reserved.subtract(quantity), actor, now);
    }

    public Stock release(BigDecimal quantity, UUID actor, Instant now) {
        requireReserved(quantity);
        return change(onHand, reserved.subtract(quantity), actor, now);
    }

    private void requireAvailable(BigDecimal quantity) {
        positive(quantity);
        if (quantity.compareTo(available()) > 0) { throw new InventoryException(INSUFFICIENT_AVAILABILITY); }
    }

    private void requireReserved(BigDecimal quantity) {
        positive(quantity);
        if (quantity.compareTo(reserved) > 0) { throw new InventoryException(RESERVATION_STATE_CONFLICT); }
    }

    private static void positive(BigDecimal quantity) {
        if (quantity == null || quantity.signum() <= 0) { throw new InventoryException(INVALID_REQUEST); }
    }

    private Stock change(BigDecimal physical, BigDecimal held, UUID actor, Instant now) {
        return new Stock(id, tenantId, productId, unit, physical, held, createdAt, createdBy, now, actor);
    }
}

