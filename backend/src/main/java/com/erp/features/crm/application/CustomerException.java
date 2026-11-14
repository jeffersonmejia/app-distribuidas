package com.erp.features.crm.application;

//SOLID: SRP — ESTA EXCEPCIÓN IDENTIFICA UN ERROR CONTROLADO DE CLIENTES.
public class CustomerException extends RuntimeException {
    private final String code;

    public CustomerException(String code) {
        super(code);
        this.code = code;
    }

    public String code() { return code; }
}
