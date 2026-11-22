package com.erp.features.marketing.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import com.erp.features.marketing.domain.model.CampaignStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

//SOLID: ISP — ESTE REPOSITORIO EXPONE SOLO CONSULTAS DE CAMPAÑAS DEL TENANT.
interface CampaignJpaRepository extends JpaRepository<CampaignEntity, UUID> {
    Optional<CampaignEntity> findByTenantIdAndId(UUID tenantId, UUID id);

    @Query("""
            select c from CampaignEntity c
            where c.tenantId = :tenant and (:status is null or c.status = :status)
            order by c.createdAt desc, c.id
            """)
    Slice<CampaignEntity> search(@Param("tenant") UUID tenant, @Param("status") CampaignStatus status,
                                 Pageable pageable);
}
