package com.erp.features.inventory.infrastructure.persistence;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.erp.features.inventory.api.InventoryMovements.*;
import com.erp.features.inventory.application.port.out.InventoryStore;
import com.erp.features.inventory.domain.model.Stock;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionSynchronizationManager;

//SOLID: SRP — ESTE ADAPTADOR PERSISTE INVENTARIO AISLADO POR TENANT.
@Repository
public class JpaInventoryStore implements InventoryStore {
    @PersistenceContext private EntityManager entityManager;
    private final JdbcTemplate jdbc;
    public JpaInventoryStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Override public void lockTenant(UUID tenantId) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Inventory requires an authorized transaction");
        }
        String configured = jdbc.queryForObject("select current_setting('app.tenant_id', true)", String.class);
        if (!tenantId.toString().equals(configured)) {
            throw new IllegalStateException("Inventory tenant differs from transaction context");
        }
        // Serializa las escrituras del tenant, incluida la primera entrada y los reintentos concurrentes.
        jdbc.query("select pg_advisory_xact_lock(hashtextextended(?, 0))", rows -> null, tenantId.toString());
    }

    @Override public Optional<Stock> findStock(UUID tenantId, UUID productId) {
        return stockEntity(tenantId, productId).map(StockEntity::toDomain);
    }

    private Optional<StockEntity> stockEntity(UUID tenantId, UUID productId) {
        return entityManager.createQuery(
                "select s from StockEntity s where s.tenantId = :tenant and s.productId = :product", StockEntity.class)
                .setParameter("tenant", tenantId).setParameter("product", productId)
                .setMaxResults(1).getResultList().stream().findFirst();
    }

    @Override public void saveStock(Stock stock) {
        StockEntity entity = stockEntity(stock.tenantId(), stock.productId()).orElse(null);
        if (entity == null) { entityManager.persist(new StockEntity(stock)); }
        else { entity.apply(stock); }
        entityManager.flush();
    }

    @Override public Optional<StoredOperation> findByKey(UUID tenantId, String key) {
        return entityManager.createQuery(
                "select o from OperationEntity o where o.tenantId = :tenant and o.key = :key", OperationEntity.class)
                .setParameter("tenant", tenantId).setParameter("key", key)
                .setMaxResults(1).getResultList().stream().findFirst().map(this::view);
    }

    @Override public Optional<StoredOperation> findOperation(UUID tenantId, UUID id) {
        return operationEntity(tenantId, id).map(this::view);
    }

    private Optional<OperationEntity> operationEntity(UUID tenantId, UUID id) {
        return entityManager.createQuery(
                "select o from OperationEntity o where o.tenantId = :tenant and o.id = :id", OperationEntity.class)
                .setParameter("tenant", tenantId).setParameter("id", id)
                .setMaxResults(1).getResultList().stream().findFirst();
    }

    @Override public void saveOperation(StoredOperation saved) {
        Operation value = saved.value();
        OperationEntity entity = new OperationEntity();
        entity.id = value.id(); entity.tenantId = value.tenantId(); entity.type = value.type();
        entity.key = saved.key(); entity.fingerprint = saved.fingerprint(); entity.source = value.sourceReference();
        entity.reservationId = value.reservationId(); entity.status = saved.status();
        entity.confirmationId = saved.confirmationId(); entity.createdAt = value.occurredAt();
        entity.updatedAt = value.occurredAt(); entity.createdBy = value.actorId(); entity.updatedBy = value.actorId();
        entityManager.persist(entity);
        entityManager.flush();
        int number = 0;
        for (Line line : value.lines()) {
            OperationLineEntity row = new OperationLineEntity();
            row.id = UUID.randomUUID(); row.tenantId = value.tenantId(); row.operationId = value.id();
            row.productId = line.productId(); row.unit = line.unit(); row.quantity = line.quantity();
            row.lineNumber = number++;
            entityManager.persist(row);
        }
        entityManager.flush();
    }

    @Override public void transition(UUID tenantId, UUID id, Status status, UUID confirmationId, UUID actorId, Instant now) {
        OperationEntity entity = operationEntity(tenantId, id).orElseThrow();
        entity.status = status; entity.confirmationId = confirmationId;
        entity.updatedAt = now; entity.updatedBy = actorId;
        entityManager.flush();
    }

    private StoredOperation view(OperationEntity entity) {
        List<Line> lines = entityManager.createQuery(
                "select l from OperationLineEntity l where l.tenantId = :tenant and l.operationId = :operation order by l.lineNumber",
                OperationLineEntity.class)
                .setParameter("tenant", entity.tenantId).setParameter("operation", entity.id).getResultList().stream()
                .map(line -> new Line(line.productId, line.unit, line.quantity)).toList();
        Operation value = new Operation(entity.id, entity.tenantId, entity.createdBy, entity.type, entity.source,
                entity.reservationId, lines, entity.createdAt);
        return new StoredOperation(value, entity.key, entity.fingerprint, entity.status, entity.confirmationId);
    }
}

