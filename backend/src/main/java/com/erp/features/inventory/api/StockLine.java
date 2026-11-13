package com.erp.features.inventory.api;

import java.math.BigDecimal;
import java.util.UUID;

//SOLID: SRP — ESTE RECORD DESCRIBE UNA LÍNEA DEL CONTRATO DE INVENTARIO.
public record StockLine(UUID productId, BigDecimal quantity) {}

