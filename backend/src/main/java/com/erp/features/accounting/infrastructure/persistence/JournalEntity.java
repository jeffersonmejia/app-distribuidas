package com.erp.features.accounting.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;

//SOLID: SRP — ESTA ENTIDAD MAPEA UN ASIENTO INMUTABLE.
@Entity @Table(name = "accounting_journal")
class JournalEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(name = "sale_id", nullable = false, updatable = false) UUID saleId;
    @Column(name = "reversal_id", updatable = false) UUID reversalId;
    @Column(name = "original_id", updatable = false) UUID originalId;
    @Column(nullable = false, updatable = false, columnDefinition = "text") String kind;
    @Column(nullable = false, updatable = false, columnDefinition = "text") String fingerprint;
    @Column(name = "created_at", nullable = false, updatable = false) Instant createdAt;
    @Column(name = "updated_at", nullable = false, updatable = false) Instant updatedAt;
    @Column(name = "created_by", nullable = false, updatable = false) UUID createdBy;
    @Column(name = "updated_by", nullable = false, updatable = false) UUID updatedBy;
    protected JournalEntity() {}
}
