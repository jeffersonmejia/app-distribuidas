package com.erp.features.projects.application.port.out;

import java.util.List;

//SOLID: SRP — ESTE TIPO REPRESENTA UNA PÁGINA OBTENIDA DESDE LA PERSISTENCIA.
public record PageResult<T>(List<T> items, boolean hasNext) { }
