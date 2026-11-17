package com.erp.features.marketing.infrastructure.persistence;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

//SOLID: ISP — ESTE REPOSITORIO EXPONE SOLO CONSULTAS DE CONTACTOS DE CAMPAÑA DEL TENANT.
interface CampaignContactJpaRepository extends JpaRepository<CampaignContactEntity, UUID> {
    String ELIGIBLE = """
            select c.customerId from CampaignContactEntity c
            where c.tenantId = :tenant and c.campaignId = :campaign
              and exists (select 1 from ContactPreferenceEntity p where p.tenantId = c.tenantId
                          and p.customerId = c.customerId
                          and p.status = com.erp.features.marketing.domain.model.ConsentStatus.CONSENTED)
              and not exists (select 1 from DeliveryEntity d where d.tenantId = c.tenantId
                              and d.campaignId = c.campaignId and d.templateId = :template
                              and d.customerId = c.customerId)
            """;

    // Idempotente ante solicitudes repetidas o simultáneas gracias a la clave única tenant-scoped.
    @Modifying
    @Query(value = """
            insert into marketing_campaign_contact (id, tenant_id, campaign_id, customer_id, created_at, created_by)
            values (:id, :tenant, :campaign, :customer, :now, :actor) on conflict do nothing
            """, nativeQuery = true)
    void add(@Param("id") UUID id, @Param("tenant") UUID tenant, @Param("campaign") UUID campaign,
             @Param("customer") UUID customer, @Param("now") Instant now, @Param("actor") UUID actor);

    @Modifying
    @Query("delete from CampaignContactEntity c where c.tenantId = :tenant and c.campaignId = :campaign "
            + "and c.customerId = :customer")
    void remove(@Param("tenant") UUID tenant, @Param("campaign") UUID campaign, @Param("customer") UUID customer);

    @Query("select c.customerId from CampaignContactEntity c where c.tenantId = :tenant "
            + "and c.campaignId = :campaign order by c.createdAt, c.customerId")
    Slice<UUID> customerIds(@Param("tenant") UUID tenant, @Param("campaign") UUID campaign, Pageable pageable);

    @Query(ELIGIBLE + " and c.customerId > :after order by c.customerId")
    List<UUID> eligible(@Param("tenant") UUID tenant, @Param("campaign") UUID campaign,
                        @Param("template") UUID template, @Param("after") UUID after, Pageable pageable);

    @Query(ELIGIBLE + " and c.customerId in :ids order by c.customerId")
    List<UUID> stillEligible(@Param("tenant") UUID tenant, @Param("campaign") UUID campaign,
                             @Param("template") UUID template, @Param("ids") List<UUID> ids);
}
