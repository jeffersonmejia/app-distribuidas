package com.erp.features.pos.presentation;

import java.util.Map;
import com.erp.features.pos.api.SaleException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

//SOLID: SRP — ESTE ADAPTADOR CONVIERTE ERRORES POS EN RESPUESTAS SEGURAS.
@RestControllerAdvice(assignableTypes = SalesController.class)
public class SalesErrorHandler {
    //SOLID: SRP — MANTIENE CÓDIGOS ESTABLES Y OCULTA DETALLES INTERNOS.
    @ExceptionHandler(SaleException.class)
    ResponseEntity<Map<String, String>> pos(SaleException error) {
        HttpStatus status = switch (error.code()) {
            case SALE_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case INSUFFICIENT_AVAILABILITY, IDEMPOTENCY_CONFLICT, UNIT_MISMATCH -> HttpStatus.CONFLICT;
            default -> HttpStatus.BAD_REQUEST;
        };
        return ResponseEntity.status(status).body(Map.of("code", error.code().name(), "message", "No se pudo procesar la venta."));
    }

    //SOLID: SRP — NORMALIZA ERRORES DE FORMATO DE HTTP.
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingRequestHeaderException.class})
    ResponseEntity<Map<String, String>> invalid(Exception error) {
        return ResponseEntity.badRequest().body(Map.of("code", "INVALID_REQUEST", "message", "Revisa los datos enviados."));
    }
}
