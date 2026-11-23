package com.erp.features.accounting.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;
import java.math.BigDecimal;
import com.erp.features.accounting.api.AccountingEntries.Entry;
import com.erp.features.accounting.api.AccountingEntries.Movement;
import com.erp.features.accounting.application.AccountingStore;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
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
        return rows.stream().findFirst().map(row -> new Stored(view(tenantId, row), row.fingerprint));
    }

    //SOLID: SRP — BUSCA UN ASIENTO DE FORMA TENANT-SCOPED.
    @Override public Optional<Entry> findEntry(UUID tenantId, UUID id) {
        return entityManager.createQuery("select j from JournalEntity j where j.tenantId = :tenant and j.id = :id",
                JournalEntity.class).setParameter("tenant", tenantId).setParameter("id", id).getResultStream()
                .findFirst().map(row -> view(tenantId, row));
    }

    //SOLID: SRP — PÁGINA ASIENTOS EN POSTGRESQL CON ORDEN ESTABLE Y FILTROS OPCIONALES.
    @Override public Slice list(UUID tenantId, UUID saleId, Instant from, Instant to, int page, int size) {
        StringBuilder statement = new StringBuilder("select j from JournalEntity j where j.tenantId = :tenant");
        if (saleId != null) { statement.append(" and j.saleId = :saleId"); }
        if (from != null) { statement.append(" and j.createdAt >= :from"); }
        if (to != null) { statement.append(" and j.createdAt < :to"); }
        statement.append(" order by j.createdAt desc, j.id desc");
        TypedQuery<JournalEntity> query = entityManager.createQuery(statement.toString(), JournalEntity.class)
                .setParameter("tenant", tenantId);
        if (saleId != null) { query.setParameter("saleId", saleId); }
        if (from != null) { query.setParameter("from", from); }
        if (to != null) { query.setParameter("to", to); }
        List<JournalEntity> rows = query.setFirstResult(firstResult(page, size)).setMaxResults(size + 1).getResultList();
        boolean hasNext = rows.size() > size;
        List<Entry> items = rows.stream().limit(size).map(row -> view(tenantId, row)).toList();
        return new Slice(items, hasNext);
    }

    //SOLID: SRP — VALIDA Y CONVIERTE EL OFFSET DE PÁGINA SIN DESBORDAR ENTEROS.
    private static int firstResult(int page, int size) {
        if (page < 0 || size < 1 || size > 5) { throw new IllegalArgumentException("Invalid page request"); }
        if (page > Integer.MAX_VALUE / size) { throw new IllegalArgumentException("Page offset is too large"); }
        return page * size;
    }

    //SOLID: SRP — AGREGA TOTALES CONTABLES A PARTIR DE LOS MOVIMIENTOS TENANT-SCOPED.
    @Override public Totals totals(UUID tenantId) {
        Object[] values = (Object[]) entityManager.createQuery(
                "select count(distinct j.id), "
                        + "coalesce(sum(case when m.side = 'DEBIT' then m.amount else 0 end), 0), "
                        + "coalesce(sum(case when m.side = 'CREDIT' then m.amount else 0 end), 0) "
                        + "from JournalEntity j left join MovementEntity m on m.tenantId = j.tenantId and m.journalId = j.id "
                        + "where j.tenantId = :tenant")
                .setParameter("tenant", tenantId).getSingleResult();
        return new Totals(((Number) values[0]).longValue(), (BigDecimal) values[1], (BigDecimal) values[2]);
    }

    //SOLID: SRP — RECONSTRUYE UN ASIENTO CON SUS MOVIMIENTOS ORDENADOS.
    private Entry view(UUID tenantId, JournalEntity row) {
        List<Movement> movements = entityManager.createQuery(
                "select m from MovementEntity m where m.tenantId = :tenant and m.journalId = :id order by m.lineNumber",
                MovementEntity.class).setParameter("tenant", tenantId).setParameter("id", row.id).getResultStream()
                .map(m -> new Movement(m.account, m.side, m.amount)).toList();
        return new Entry(row.id, row.saleId, row.reversalId, row.originalId, row.createdAt, movements);
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
