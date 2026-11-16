package com.erp.features.pos.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.erp.features.pos.api.Sales.Sale;
import com.erp.features.pos.api.Sales.SoldLine;
import com.erp.features.pos.application.SaleStore;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;

//SOLID: SRP — ESTE ADAPTADOR PERSISTE VENTAS DENTRO DE LA TRANSACCIÓN EXISTENTE.
@Repository
public class JpaSaleStore implements SaleStore {
    private final EntityManager entityManager;
    public JpaSaleStore(EntityManager entityManager) { this.entityManager = entityManager; }

    @Override public Optional<StoredSale> find(UUID tenantId, UUID saleId) {
        List<SaleEntity> sales = entityManager.createQuery(
                "select s from SaleEntity s where s.tenantId = :tenant and s.saleId = :sale", SaleEntity.class)
                .setParameter("tenant", tenantId).setParameter("sale", saleId).getResultList();
        return sales.stream().findFirst().map(entity -> {
            List<SoldLine> lines = entityManager.createQuery(
                    "select l from SaleLineEntity l where l.tenantId = :tenant and l.saleRecordId = :id order by l.lineNumber",
                    SaleLineEntity.class).setParameter("tenant", tenantId).setParameter("id", entity.id)
                    .getResultStream().map(line -> new SoldLine(line.productId, line.unit, line.quantity,
                            line.unitPrice, line.taxAmount, line.netAmount)).toList();
            return new StoredSale(entity.fingerprint, new Sale(entity.saleId, entity.movementId, entity.createdAt, lines));
        });
    }
    @Override public void save(UUID tenantId, UUID actorId, String fingerprint, Sale sale) {
        SaleEntity entity = new SaleEntity();
        entity.id = UUID.randomUUID(); entity.tenantId = tenantId; entity.saleId = sale.saleId();
        entity.movementId = sale.movementId(); entity.fingerprint = fingerprint;
        entity.createdAt = sale.createdAt(); entity.updatedAt = sale.createdAt();
        entity.createdBy = actorId; entity.updatedBy = actorId;
        entityManager.persist(entity);
        int index = 0;
        for (SoldLine line : sale.lines()) {
            SaleLineEntity row = new SaleLineEntity();
            row.id = UUID.randomUUID(); row.tenantId = tenantId; row.saleRecordId = entity.id;
            row.lineNumber = index++; row.productId = line.productId(); row.unit = line.unit();
            row.quantity = line.quantity(); row.unitPrice = line.unitPrice(); row.taxAmount = line.taxAmount();
            row.netAmount = line.netAmount(); entityManager.persist(row);
        }
        entityManager.flush();
    }
}
