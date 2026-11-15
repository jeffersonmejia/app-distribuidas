package com.erp.features.inventory.infrastructure.persistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;
import com.erp.features.inventory.domain.model.Stock;

//SOLID: SRP — ESTA ENTIDAD MAPEA EL SALDO Y SU AUDITORÍA EN POSTGRESQL.
@Entity
@Table(name = "inventory_stock")
public class StockEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(name = "product_id", nullable = false, updatable = false) UUID productId;
    @Column(nullable = false, updatable = false, columnDefinition = "text") String unit;
    @Column(name = "on_hand", nullable = false, columnDefinition = "numeric") BigDecimal onHand;
    @Column(nullable = false, columnDefinition = "numeric") BigDecimal reserved;
    @Column(name = "created_at", nullable = false, updatable = false) Instant createdAt;
    @Column(name = "created_by", nullable = false, updatable = false) UUID createdBy;
    @Column(name = "updated_at", nullable = false) Instant updatedAt;
    @Column(name = "updated_by", nullable = false) UUID updatedBy;
    protected StockEntity() {}
    StockEntity(Stock stock) { apply(stock); }
    void apply(Stock stock) {
        id = stock.id(); tenantId = stock.tenantId(); productId = stock.productId(); unit = stock.unit();
        onHand = stock.onHand(); reserved = stock.reserved(); createdAt = stock.createdAt();
        createdBy = stock.createdBy(); updatedAt = stock.updatedAt(); updatedBy = stock.updatedBy();
    }
    Stock toDomain() {
        return new Stock(id, tenantId, productId, unit, onHand, reserved, createdAt, createdBy, updatedAt, updatedBy);
    }
}

