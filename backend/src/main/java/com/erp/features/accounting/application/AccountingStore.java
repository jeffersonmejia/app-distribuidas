package com.erp.features.accounting.application;

import java.util.Optional;
import java.util.UUID;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.List;
import com.erp.features.accounting.api.AccountingEntries.Entry;

//SOLID: DIP — ESTE PUERTO SEPARA LOS CASOS DE USO DE LA PERSISTENCIA.
public interface AccountingStore {
    //SOLID: SRP — ESTE TIPO ASOCIA UN ASIENTO Y SU CONTENIDO IDEMPOTENTE.
    record Stored(Entry entry, String fingerprint) {}
    //SOLID: SRP — TRANSPORTA UNA PÁGINA Y SU INDICADOR DE CONTINUACIÓN.
    record Slice(List<Entry> items, boolean hasNext) {}
    //SOLID: SRP — TRANSPORTA TOTALES AGREGADOS EN LA BASE.
    record Totals(long entryCount, BigDecimal debit, BigDecimal credit) {}
    void lock(UUID tenantId);
    Optional<Stored> findSale(UUID tenantId, UUID saleId);
    Optional<Stored> findReversal(UUID tenantId, UUID saleId);
    Optional<Stored> findReversalId(UUID tenantId, UUID reversalId);
    Optional<Entry> findEntry(UUID tenantId, UUID id);
    Slice list(UUID tenantId, UUID saleId, Instant from, Instant to, int page, int size);
    Totals totals(UUID tenantId);
    void save(UUID tenantId, UUID actorId, boolean reversal, String fingerprint, Entry entry);
}
