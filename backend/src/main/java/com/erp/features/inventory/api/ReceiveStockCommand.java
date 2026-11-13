package com.erp.features.inventory.api;

import java.util.List;

//SOLID: SRP — ESTE RECORD DESCRIBE UNA SOLICITUD DE ENTRADA.
public record ReceiveStockCommand(String operationKey, String sourceReference, List<StockLine> lines) {}

