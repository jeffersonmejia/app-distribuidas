package com.erp.features.inventory.infrastructure.persistence;

import java.math.BigDecimal;
import java.util.UUID;
import jakarta.persistence.*;

//SOLID: SRP — ESTA ENTIDAD MAPEA UNA LÍNEA INMUTABLE DEL REGISTRO DE MOVIMIENTOS.
@Entity
@Table(name = "inventory_operation_line")
public class OperationLineEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(name = "operation_id", nullable = false, updatable = false) UUID operationId;
    @Column(name = "product_id", nullable = false, updatable = false) UUID productId;
    @Column(name = "line_number", nullable = false, updatable = false) int lineNumber;
    @Column(nullable = false, updatable = false, columnDefinition = "text") String unit;
    @Column(nullable = false, updatable = false, columnDefinition = "numeric") BigDecimal quantity;
    protected OperationLineEntity() {}
}

