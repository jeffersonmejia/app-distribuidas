package com.erp.features.accounting.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.erp.features.accounting.api.AccountingEntries.Entry;
import com.erp.features.accounting.api.AccountingEntries.Movement;
import com.erp.features.accounting.application.AccountingStore;
import jakarta.persistence.EntityManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

//SOLID: SRP — ESTE ADAPTADOR PERSISTE ASIENTOS EN LA TRANSACCIÓN EXISTENTE.
@Repository
public class JpaAccountingStore implements AccountingStore {
    private final EntityManager entityManager;
    private final JdbcTemplate jdbc;
    public JpaAccountingStore(EntityManager entityManager, JdbcTemplate jdbc) {
        this.entityManager = entityManager; this.jdbc = jdbc;
    }
    @Override public void lock(UUID tenantId) {
        jdbc.query("select pg_advisory_xact_lock(hashtextextended(?, 0))",
                result -> {}, "accounting:" + tenantId);
    }
    @Override public Optional<Stored> findSale(UUID tenantId, UUID saleId) {
        return find(tenantId, false, saleId, "SALE");
    }
    @Override public Optional<Stored> findReversal(UUID tenantId, UUID saleId) {
        return find(tenantId, false, saleId, "REVERSAL");
    }
    @Override public Optional<Stored> findReversalId(UUID tenantId, UUID reversalId) {
        return find(tenantId, true, reversalId, "REVERSAL");
    }
    private Optional<Stored> find(UUID tenantId, boolean byReversalId, UUID value, String kind) {
        String query = byReversalId
                ? "select j from JournalEntity j where j.tenantId = :tenant and j.reversalId = :value and j.kind = :kind"
                : "select j from JournalEntity j where j.tenantId = :tenant and j.saleId = :value and j.kind = :kind";
        List<JournalEntity> rows = entityManager.createQuery(
                query, JournalEntity.class).setParameter("tenant", tenantId).setParameter("value", value)
                .setParameter("kind", kind).getResultList();
        return rows.stream().findFirst().map(row -> {
            List<Movement> movements = entityManager.createQuery(
                    "select m from MovementEntity m where m.tenantId = :tenant and m.journalId = :id order by m.lineNumber",
                    MovementEntity.class).setParameter("tenant", tenantId).setParameter("id", row.id)
                    .getResultStream().map(m -> new Movement(m.account, m.side, m.amount)).toList();
            return new Stored(new Entry(row.id, row.saleId, row.reversalId, row.originalId, row.createdAt, movements),
                    row.fingerprint);
        });
    }
    @Override public void save(UUID tenantId, UUID actorId, boolean reversal, String fingerprint, Entry entry) {
        JournalEntity row = new JournalEntity();
        row.id = entry.id(); row.tenantId = tenantId; row.saleId = entry.saleId();
        row.reversalId = entry.reversalId(); row.originalId = entry.originalId();
        row.kind = reversal ? "REVERSAL" : "SALE"; row.fingerprint = fingerprint;
        row.createdAt = entry.createdAt(); row.updatedAt = entry.createdAt();
        row.createdBy = actorId; row.updatedBy = actorId;
        entityManager.persist(row);
        int index = 0;
        for (Movement movement : entry.movements()) {
            MovementEntity line = new MovementEntity();
            line.id = UUID.randomUUID(); line.tenantId = tenantId; line.journalId = entry.id();
            line.lineNumber = index++; line.account = movement.account(); line.side = movement.side();
            line.amount = movement.amount(); entityManager.persist(line);
        }
        entityManager.flush();
    }
}
