package com.erp.features.projects.application.usecase;

//SOLID: SRP — ESTA EXCEPCIÓN IDENTIFICA UN ERROR CONTROLADO DE PROYECTOS Y TAREAS.
public class ProjectsException extends RuntimeException {
    private final String code;

    public ProjectsException(String code) {
        super(code);
        this.code = code;
    }

    public String code() { return code; }
}
