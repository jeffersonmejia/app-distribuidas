package com.erp.features.marketing.infrastructure.persistence;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import com.erp.features.marketing.application.port.out.ConsentStore;
import com.erp.features.marketing.domain.model.ConsentStatus;
import org.springframework.stereotype.Repository;

//SOLID: SRP — ESTE ADAPTADOR IMPLEMENTA LA PERSISTENCIA DE CONSENTIMIENTOS Y BAJAS AISLADA POR TENANT.
@Repository
public class ConsentPersistence implements ConsentStore {
    private final ContactPreferenceJpaRepository repository;

    public ConsentPersistence(ContactPreferenceJpaRepository repository) { this.repository = repository; }

    @Override public Map<UUID, ConsentStatus> statuses(UUID tenantId, List<UUID> customerIds) {
        if (customerIds.isEmpty()) { return Map.of(); }
        return repository.findByTenantIdAndCustomerIdIn(tenantId, customerIds).stream()
                .collect(Collectors.toMap(entity -> entity.customerId, entity -> entity.status));
    }

    @Override public void save(UUID tenantId, UUID customerId, ConsentStatus status, UUID actorId, Instant now) {
        ContactPreferenceEntity entity = repository.findByTenantIdAndCustomerIdIn(tenantId, List.of(customerId))
                .stream().findFirst().orElseGet(() -> new ContactPreferenceEntity(tenantId, customerId, actorId, now));
        entity.status = status;
        entity.updatedAt = now;
        entity.updatedBy = actorId;
        repository.saveAndFlush(entity);
    }
}
