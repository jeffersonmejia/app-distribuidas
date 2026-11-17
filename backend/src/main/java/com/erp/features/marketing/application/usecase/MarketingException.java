package com.erp.features.marketing.application.usecase;

//SOLID: SRP — ESTA EXCEPCIÓN IDENTIFICA UN ERROR CONTROLADO DE MARKETING.
public class MarketingException extends RuntimeException {
    private final String code;

    public MarketingException(String code) {
        super(code);
        this.code = code;
    }

    public String code() { return code; }
}
