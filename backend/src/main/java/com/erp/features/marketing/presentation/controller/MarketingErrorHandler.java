package com.erp.features.marketing.presentation.controller;

import java.util.Map;
import com.erp.features.marketing.application.usecase.MarketingException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

//SOLID: SRP — ESTE ADAPTADOR CONVIERTE ERRORES DE MARKETING EN RESPUESTAS SEGURAS.
@RestControllerAdvice(assignableTypes = {CampaignController.class, TemplateController.class, ConsentController.class})
public class MarketingErrorHandler {
    @ExceptionHandler(MarketingException.class)
    ResponseEntity<Map<String, String>> marketing(MarketingException error) {
        HttpStatus status = switch (error.code()) {
            case "CAMPAIGN_NOT_FOUND", "TEMPLATE_NOT_FOUND", "CONTACT_NOT_FOUND" -> HttpStatus.NOT_FOUND;
            case "INVALID_CAMPAIGN_TRANSITION", "CAMPAIGN_NOT_ACTIVE", "CONTACT_UNSUBSCRIBED", "DAILY_LIMIT_REACHED" ->
                    HttpStatus.CONFLICT;
            case "MAIL_PROVIDER_ERROR" -> HttpStatus.BAD_GATEWAY;
            default -> HttpStatus.BAD_REQUEST;
        };
        return ResponseEntity.status(status).body(Map.of("code", error.code(), "message", "No se pudo procesar la solicitud de Marketing."));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingRequestHeaderException.class})
    ResponseEntity<Map<String, String>> invalid(Exception error) {
        return ResponseEntity.badRequest().body(Map.of("code", "INVALID_REQUEST", "message", "Revisa los datos enviados."));
    }
}
