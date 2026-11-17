package com.erp.features.marketing.application.dto;

import java.util.List;

//SOLID: SRP — ESTE DTO TRANSPORTA UNA PÁGINA DE RESULTADOS.
public record PageView<T>(List<T> items, int page, int size, boolean hasNext) { }
