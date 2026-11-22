package com.erp.features.inventory.domain.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import com.erp.features.inventory.domain.model.InventoryException.Code;

//SOLID: SRP — ESTE MODELO CONSERVA LOS DATOS Y LAS REGLAS DEL CATÁLOGO.
public record Product(UUID id, UUID tenantId, String name, String sku, String category, String description,
                      String unit, BigDecimal purchasePrice, BigDecimal sellingPrice, BigDecimal minStock,
                      Instant createdAt, UUID createdBy, Instant updatedAt, UUID updatedBy) {
    private static final Set<String> CATEGORIES = Set.of("Materiales", "Equipos", "Herramientas", "Repuestos", "Servicios");

    //SOLID: SRP — VALIDA LOS INVARIANTES DEL PRODUCTO SIN DEPENDER DE INFRAESTRUCTURA.
    public Product {
        if (id == null || tenantId == null || createdAt == null || createdBy == null || updatedAt == null
                || updatedBy == null || !text(name, 160) || !text(sku, 64) || !CATEGORIES.contains(category)
                || !text(unit, 64) || purchasePrice == null || sellingPrice == null || minStock == null
                || purchasePrice.signum() < 0 || sellingPrice.signum() < 0 || minStock.signum() < 0
                || purchasePrice.scale() != 2 || sellingPrice.scale() != 2) {
            throw new InventoryException(Code.INVALID_REQUEST);
        }
        if (description != null && description.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 2000) {
            throw new InventoryException(Code.INVALID_REQUEST);
        }
    }

    //SOLID: SRP — CREA UNA VERSIÓN ACTUALIZADA MANTENIENDO IDENTIDAD Y AUDITORÍA.
    public Product update(String name, String sku, String category, String description, String unit,
                          BigDecimal purchasePrice, BigDecimal sellingPrice, BigDecimal minStock,
                          UUID actorId, Instant now) {
        if (!this.unit.equals(unit)) { throw new InventoryException(Code.UNIT_MISMATCH); }
        return new Product(id, tenantId, name, sku, category, description, this.unit, purchasePrice,
                sellingPrice, minStock, createdAt, createdBy, now, actorId);
    }

    private static boolean text(String value, int maxBytes) {
        return value != null && !value.isBlank()
                && java.nio.charset.StandardCharsets.UTF_8.newEncoder().canEncode(value)
                && value.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= maxBytes;
    }
}
