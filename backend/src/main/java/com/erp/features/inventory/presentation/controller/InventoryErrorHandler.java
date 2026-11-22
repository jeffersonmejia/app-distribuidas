package com.erp.features.inventory.presentation.controller;

import java.util.Map;
import com.erp.features.inventory.domain.model.InventoryException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

//SOLID: SRP — ESTE ADAPTADOR MAPEA ERRORES DE INVENTORY A CÓDIGOS HTTP ESTABLES.
@RestControllerAdvice(assignableTypes = ProductController.class)
public class InventoryErrorHandler {
    //SOLID: SRP — DEVUELVE SOLO CÓDIGO DE ERROR, SIN FILTRAR DETALLES INTERNOS.
    @ExceptionHandler(InventoryException.class)
    ResponseEntity<Map<String, String>> inventory(InventoryException error) {
        HttpStatus status = switch (error.code()) {
            case PRODUCT_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case SKU_ALREADY_EXISTS, UNIT_MISMATCH, IDEMPOTENCY_CONFLICT, INSUFFICIENT_AVAILABILITY -> HttpStatus.CONFLICT;
            default -> HttpStatus.BAD_REQUEST;
        };
        return ResponseEntity.status(status).body(Map.of("code", error.code().name(), "message", "No se pudo procesar la solicitud de Inventory."));
    }

    //SOLID: SRP — NORMALIZA ERRORES DE FORMATO Y PARÁMETROS HTTP.
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingRequestHeaderException.class})
    ResponseEntity<Map<String, String>> invalid(Exception error) {
        return ResponseEntity.badRequest().body(Map.of("code", "INVALID_REQUEST", "message", "Revisa los datos enviados."));
    }
}
