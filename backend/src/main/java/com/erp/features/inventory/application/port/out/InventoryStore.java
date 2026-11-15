package com.erp.features.inventory.application.port.out;

import java.util.Optional;
import java.util.UUID;
import com.erp.features.inventory.api.InventoryMovements.Operation;
import com.erp.features.inventory.api.InventoryMovements.Status;
import com.erp.features.inventory.domain.model.Stock;

//SOLID: DIP — LA APLICACIÓN DEPENDE DE ESTE PUERTO Y NO DE JPA.
public interface InventoryStore {
    //SOLID: SRP — ESTE RECORD TRANSPORTA UNA OPERACIÓN PERSISTIDA Y SU ESTADO.
    record StoredOperation(Operation value, String key, String fingerprint, Status status, UUID confirmationId) {}

    void lockTenant(UUID tenantId);
    Optional<Stock> findStock(UUID tenantId, UUID productId);
    void saveStock(Stock stock);
    Optional<StoredOperation> findByKey(UUID tenantId, String key);
    Optional<StoredOperation> findOperation(UUID tenantId, UUID id);
    void saveOperation(StoredOperation operation);
    void transition(UUID tenantId, UUID reservationId, Status status, UUID confirmationId,
                    UUID actorId, java.time.Instant now);
}

