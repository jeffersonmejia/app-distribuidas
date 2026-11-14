package com.erp.features.crm.presentation.controller;

import java.util.Map;
import com.erp.features.crm.application.CustomerException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

//SOLID: SRP — ESTE ADAPTADOR CONVIERTE ERRORES DE CRM EN RESPUESTAS SEGURAS.
@RestControllerAdvice(assignableTypes = CustomerController.class)
public class CustomerErrorHandler {
    @ExceptionHandler(CustomerException.class)
    ResponseEntity<Map<String, String>> customer(CustomerException error) {
        HttpStatus status = switch (error.code()) {
            case "CUSTOMER_NOT_FOUND" -> HttpStatus.NOT_FOUND;
            case "CUSTOMER_CEDULA_ALREADY_EXISTS", "CUSTOMER_EMAIL_ALREADY_EXISTS" -> HttpStatus.CONFLICT;
            default -> HttpStatus.BAD_REQUEST;
        };
        return ResponseEntity.status(status).body(Map.of("code", error.code()));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingRequestHeaderException.class})
    ResponseEntity<Map<String, String>> invalid(Exception error) {
        return ResponseEntity.badRequest().body(Map.of("code", "INVALID_CUSTOMER_DATA"));
    }
}
