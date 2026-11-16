package com.erp.features.accounting.application;

import java.util.Optional;
import java.util.UUID;
import com.erp.features.accounting.api.AccountingEntries.Entry;

//SOLID: DIP — ESTE PUERTO SEPARA LOS CASOS DE USO DE LA PERSISTENCIA.
public interface AccountingStore {
    //SOLID: SRP — ESTE TIPO ASOCIA UN ASIENTO Y SU CONTENIDO IDEMPOTENTE.
    record Stored(Entry entry, String fingerprint) {}
    void lock(UUID tenantId);
    Optional<Stored> findSale(UUID tenantId, UUID saleId);
    Optional<Stored> findReversal(UUID tenantId, UUID saleId);
    Optional<Stored> findReversalId(UUID tenantId, UUID reversalId);
    void save(UUID tenantId, UUID actorId, boolean reversal, String fingerprint, Entry entry);
}
