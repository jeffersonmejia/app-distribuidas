package com.erp.features.pos.infrastructure.persistence;

import java.math.BigDecimal;
import java.util.UUID;
import jakarta.persistence.*;

//SOLID: SRP — ESTA ENTIDAD MAPEA UNA LÍNEA INMUTABLE DE LA VENTA.
@Entity
@Table(name = "pos_sale_line")
class SaleLineEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(name = "sale_record_id", nullable = false, updatable = false) UUID saleRecordId;
    @Column(name = "line_number", nullable = false, updatable = false) int lineNumber;
    @Column(name = "product_id", nullable = false, updatable = false) UUID productId;
    @Column(nullable = false, updatable = false, columnDefinition = "text") String unit;
    @Column(nullable = false, updatable = false, columnDefinition = "numeric") BigDecimal quantity;
    @Column(name = "unit_price", nullable = false, updatable = false, columnDefinition = "numeric") BigDecimal unitPrice;
    @Column(name = "tax_amount", nullable = false, updatable = false, columnDefinition = "numeric") BigDecimal taxAmount;
    @Column(name = "net_amount", nullable = false, updatable = false, columnDefinition = "numeric") BigDecimal netAmount;
    protected SaleLineEntity() {}
}
