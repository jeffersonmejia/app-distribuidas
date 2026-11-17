package com.erp.features.marketing.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

//SOLID: ISP — ESTE REPOSITORIO EXPONE SOLO CONSULTAS DE PREFERENCIAS DE CONTACTO DEL TENANT.
interface ContactPreferenceJpaRepository extends JpaRepository<ContactPreferenceEntity, UUID> {
    List<ContactPreferenceEntity> findByTenantIdAndCustomerIdIn(UUID tenantId, List<UUID> customerIds);
}
