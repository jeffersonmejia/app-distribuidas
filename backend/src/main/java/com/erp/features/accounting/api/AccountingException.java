package com.erp.features.accounting.api;

//SOLID: SRP — ESTA EXCEPCIÓN EXPONE ERRORES CONTABLES CONTROLADOS.
public class AccountingException extends RuntimeException {
    public enum Code { INVALID_REQUEST, SALE_NOT_FOUND, JOURNAL_NOT_FOUND, IDEMPOTENCY_CONFLICT, ALREADY_REVERSED }
    private final Code code;
    public AccountingException(Code code) { super(code.name()); this.code = code; }
    public Code code() { return code; }
}
