package com.erp.features.inventory.domain.model;

import com.erp.features.inventory.api.InventoryFailure;

//SOLID: SRP — ESTA EXCEPCIÓN EXPONE UN CÓDIGO ESTABLE SIN DATOS SENSIBLES.
public class InventoryException extends RuntimeException implements InventoryFailure {
    public enum Code {
        INVALID_REQUEST, PRODUCT_NOT_FOUND, RESERVATION_NOT_FOUND, UNIT_MISMATCH,
        INSUFFICIENT_AVAILABILITY, RESERVATION_STATE_CONFLICT, SOURCE_REFERENCE_MISMATCH,
        IDEMPOTENCY_CONFLICT
    }
    private final Code code;
    public InventoryException(Code code) { super(code.name()); this.code = code; }
    public Code code() { return code; }
    @Override public String inventoryCode() { return code.name(); }
}

