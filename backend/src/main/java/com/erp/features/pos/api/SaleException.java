package com.erp.features.pos.api;

//SOLID: SRP — ESTA EXCEPCIÓN EXPONE ERRORES ESTABLES DE VENTAS.
public class SaleException extends RuntimeException {
    public enum Code {
        INVALID_REQUEST, PRODUCT_NOT_FOUND, RESERVATION_NOT_FOUND, UNIT_MISMATCH,
        INSUFFICIENT_AVAILABILITY, RESERVATION_STATE_CONFLICT, SOURCE_REFERENCE_MISMATCH,
        IDEMPOTENCY_CONFLICT, INVENTORY_ERROR
    }
    private final Code code;
    public SaleException(Code code) { super(code.name()); this.code = code; }
    public Code code() { return code; }
}
