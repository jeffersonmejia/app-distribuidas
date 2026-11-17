package com.erp.features.accounting.infrastructure.persistence;

import java.math.BigDecimal;
import java.util.UUID;
import jakarta.persistence.*;

//SOLID: SRP — ESTA ENTIDAD MAPEA UN MOVIMIENTO CONTABLE INMUTABLE.
@Entity @Table(name = "accounting_movement")
class MovementEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(name = "journal_id", nullable = false, updatable = false) UUID journalId;
    @Column(name = "line_number", nullable = false, updatable = false) int lineNumber;
    @Column(nullable = false, updatable = false, columnDefinition = "text") String account;
    @Column(nullable = false, updatable = false, columnDefinition = "text") String side;
    @Column(nullable = false, updatable = false, columnDefinition = "numeric") BigDecimal amount;
    protected MovementEntity() {}
}
