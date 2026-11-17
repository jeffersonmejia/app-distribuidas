package com.erp.features.marketing.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

//SOLID: ISP — ESTE REPOSITORIO EXPONE SOLO EL CONTEO DE ENTREGAS DEL TENANT.
interface DeliveryJpaRepository extends JpaRepository<DeliveryEntity, UUID> {
    long countByTenantIdAndSentAtGreaterThanEqual(UUID tenantId, Instant since);
}
