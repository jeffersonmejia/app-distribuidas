package com.erp.features.accounting.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.erp.features.tenancy.api.TenantId;

//SOLID: ISP — ESTE CONTRATO EXPONE EL REGISTRO Y REVERSO DE ASIENTOS.
public interface AccountingEntries {
    //SOLID: SRP — ESTE COMANDO TRANSPORTA EL TOTAL Y LOS IMPUESTOS RECIBIDOS DE POS.
    record SaleCommand(UUID saleId, BigDecimal total, List<BigDecimal> lineTaxes) {
        public SaleCommand {
            if (lineTaxes != null) { lineTaxes = java.util.Collections.unmodifiableList(new java.util.ArrayList<>(lineTaxes)); }
        }
    }
    //SOLID: SRP — ESTE COMANDO IDENTIFICA UN REVERSO TOTAL IDEMPOTENTE.
    record ReversalCommand(UUID saleId, UUID reversalId) {}
    //SOLID: SRP — ESTE TIPO TRANSPORTA UN MOVIMIENTO CONTABLE.
    record Movement(String account, String side, BigDecimal amount) {}
    //SOLID: SRP — ESTE TIPO TRANSPORTA EL ASIENTO CONFIRMADO.
    record Entry(UUID id, UUID saleId, UUID reversalId, UUID originalId, Instant createdAt,
                 List<Movement> movements) {
        public Entry { movements = List.copyOf(movements); }
    }
    //SOLID: SRP — TRANSPORTA UNA PÁGINA DE ASIENTOS EXISTENTES.
    record Page(List<Entry> items, int page, int size, boolean hasNext) {
        public Page { items = List.copyOf(items); }
    }
    //SOLID: SRP — TRANSPORTA TOTALES CALCULADOS DESDE LOS MOVIMIENTOS PERSISTIDOS.
    record Summary(long totalEntries, BigDecimal totalDebit, BigDecimal totalCredit) {}
    Entry recordSale(TenantId tenant, SaleCommand command);
    Entry reverse(TenantId tenant, ReversalCommand command);
    Page list(TenantId tenant, String search, String period, int page, int size);
    Entry get(TenantId tenant, UUID id);
    Summary summary(TenantId tenant);
}
