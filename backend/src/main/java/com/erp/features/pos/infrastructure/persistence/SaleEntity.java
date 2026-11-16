package com.erp.features.pos.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;

//SOLID: SRP — ESTA ENTIDAD MAPEA LA CABECERA INMUTABLE DE LA VENTA.
@Entity
@Table(name = "pos_sale")
class SaleEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(name = "sale_id", nullable = false, updatable = false) UUID saleId;
    @Column(name = "inventory_movement_id", nullable = false, updatable = false) UUID movementId;
    @Column(nullable = false, updatable = false, columnDefinition = "text") String fingerprint;
    @Column(name = "created_at", nullable = false, updatable = false) Instant createdAt;
    @Column(name = "updated_at", nullable = false, updatable = false) Instant updatedAt;
    @Column(name = "created_by", nullable = false, updatable = false) UUID createdBy;
    @Column(name = "updated_by", nullable = false, updatable = false) UUID updatedBy;
    protected SaleEntity() {}
}
