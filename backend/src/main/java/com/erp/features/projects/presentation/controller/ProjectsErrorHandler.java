package com.erp.features.projects.presentation.controller;

import java.util.Map;
import com.erp.features.projects.application.usecase.ProjectsException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

//SOLID: SRP — ESTE ADAPTADOR CONVIERTE ERRORES DE PROYECTOS EN RESPUESTAS SEGURAS.
@RestControllerAdvice(assignableTypes = {ProjectController.class, TaskController.class})
public class ProjectsErrorHandler {
    @ExceptionHandler(ProjectsException.class)
    ResponseEntity<Map<String, String>> projects(ProjectsException error) {
        HttpStatus status = switch (error.code()) {
            case "PROJECT_NOT_FOUND", "TASK_NOT_FOUND", "DELETED_PROJECT_NOT_FOUND", "DELETED_TASK_NOT_FOUND" ->
                    HttpStatus.NOT_FOUND;
            case "INVALID_TASK_TRANSITION" -> HttpStatus.CONFLICT;
            default -> HttpStatus.BAD_REQUEST;
        };
        return ResponseEntity.status(status).body(Map.of("code", error.code(), "message", "No se pudo procesar la solicitud de Projects."));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingRequestHeaderException.class})
    ResponseEntity<Map<String, String>> invalid(Exception error) {
        return ResponseEntity.badRequest().body(Map.of("code", "INVALID_REQUEST", "message", "Revisa los datos enviados."));
    }
}
