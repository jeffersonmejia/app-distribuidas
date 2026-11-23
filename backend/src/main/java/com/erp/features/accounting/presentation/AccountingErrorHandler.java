package com.erp.features.accounting.presentation;

import java.util.Map;
import com.erp.features.accounting.api.AccountingException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

//SOLID: SRP — ESTE ADAPTADOR MANTIENE ERRORES CONTABLES SEGUROS Y ESTABLES.
@RestControllerAdvice(assignableTypes = AccountingController.class)
public class AccountingErrorHandler {
    //SOLID: SRP — MAPEA ERRORES CONTABLES SIN DETALLES INTERNOS.
    @ExceptionHandler(AccountingException.class)
    ResponseEntity<Map<String, String>> accounting(AccountingException error) {
        HttpStatus status = error.code() == AccountingException.Code.JOURNAL_NOT_FOUND
                ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status).body(Map.of("code", error.code().name(), "message", "No se pudo consultar el asiento."));
    }

    //SOLID: SRP — NORMALIZA ERRORES DE JSON, PARÁMETROS Y SELECTOR DE TENANT.
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingRequestHeaderException.class})
    ResponseEntity<Map<String, String>> invalid(Exception error) {
        return ResponseEntity.badRequest().body(Map.of("code", "INVALID_REQUEST", "message", "Revisa los datos enviados."));
    }
}
