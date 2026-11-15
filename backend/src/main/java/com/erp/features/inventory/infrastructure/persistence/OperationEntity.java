package com.erp.features.inventory.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;
import com.erp.features.inventory.api.InventoryMovements.Type;
import com.erp.features.inventory.api.InventoryMovements.Status;

//SOLID: SRP — ESTA ENTIDAD MAPEA EL REGISTRO DE OPERACIÓN Y LA TRANSICIÓN DE RESERVA.
@Entity
@Table(name = "inventory_operation")
public class OperationEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(name = "operation_key", nullable = false, updatable = false, columnDefinition = "text") String key;
    @Column(nullable = false, updatable = false, columnDefinition = "text") String fingerprint;
    @Enumerated(EnumType.STRING) @Column(nullable = false, updatable = false, columnDefinition = "text") Type type;
    @Column(name = "source_reference", nullable = false, updatable = false, columnDefinition = "text") String source;
    @Column(name = "reservation_id", updatable = false) UUID reservationId;
    @Enumerated(EnumType.STRING) @Column(columnDefinition = "text") Status status;
    @Column(name = "confirmation_id") UUID confirmationId;
    @Column(name = "created_at", nullable = false, updatable = false) Instant createdAt;
    @Column(name = "created_by", nullable = false, updatable = false) UUID createdBy;
    @Column(name = "updated_at", nullable = false) Instant updatedAt;
    @Column(name = "updated_by", nullable = false) UUID updatedBy;
    protected OperationEntity() {}
}

