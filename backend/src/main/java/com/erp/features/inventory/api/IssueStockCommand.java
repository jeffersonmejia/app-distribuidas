package com.erp.features.inventory.api;

import java.util.List;

//SOLID: SRP — ESTE RECORD DESCRIBE UNA SOLICITUD DE SALIDA DIRECTA.
public record IssueStockCommand(String operationKey, String sourceReference, List<StockLine> lines) {}

