package com.erp.features.marketing.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

//SOLID: ISP — ESTE REPOSITORIO EXPONE SOLO CONSULTAS DE PLANTILLAS DEL TENANT.
interface TemplateJpaRepository extends JpaRepository<TemplateEntity, UUID> {
    Optional<TemplateEntity> findByTenantIdAndId(UUID tenantId, UUID id);

    @Query("select t from TemplateEntity t where t.tenantId = :tenant order by lower(t.name), t.id")
    Slice<TemplateEntity> search(@Param("tenant") UUID tenant, Pageable pageable);
}
