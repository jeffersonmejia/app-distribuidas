package com.erp.features.marketing.infrastructure.persistence;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.erp.features.marketing.application.port.out.CampaignStore;
import com.erp.features.marketing.application.port.out.PageResult;
import com.erp.features.marketing.domain.model.Campaign;
import com.erp.features.marketing.domain.model.CampaignStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

//SOLID: SRP — ESTE ADAPTADOR IMPLEMENTA LA PERSISTENCIA DE CAMPAÑAS, CONTACTOS Y ENTREGAS AISLADA POR TENANT.
@Repository
public class CampaignPersistence implements CampaignStore {
    private final CampaignJpaRepository campaigns;
    private final CampaignContactJpaRepository contacts;
    private final DeliveryJpaRepository deliveries;
    private final JdbcTemplate jdbc;

    public CampaignPersistence(CampaignJpaRepository campaigns, CampaignContactJpaRepository contacts,
                               DeliveryJpaRepository deliveries, JdbcTemplate jdbc) {
        this.campaigns = campaigns;
        this.contacts = contacts;
        this.deliveries = deliveries;
        this.jdbc = jdbc;
    }

    @Override public Optional<Campaign> find(UUID tenantId, UUID id) {
        return campaigns.findByTenantIdAndId(tenantId, id).map(CampaignEntity::toDomain);
    }

    @Override public Campaign save(Campaign campaign) {
        CampaignEntity entity = campaigns.findByTenantIdAndId(campaign.tenantId(), campaign.id())
                .orElseGet(() -> new CampaignEntity(campaign));
        entity.apply(campaign);
        return campaigns.saveAndFlush(entity).toDomain();
    }

    @Override public PageResult<Campaign> list(UUID tenantId, CampaignStatus status, int page, int size) {
        var result = campaigns.search(tenantId, status, PageRequest.of(page, size));
        return new PageResult<>(result.getContent().stream().map(CampaignEntity::toDomain).toList(), result.hasNext());
    }

    @Override public void addContact(UUID tenantId, UUID campaignId, UUID customerId, UUID actorId, Instant now) {
        contacts.add(UUID.randomUUID(), tenantId, campaignId, customerId, now, actorId);
    }

    @Override public void removeContact(UUID tenantId, UUID campaignId, UUID customerId) {
        contacts.remove(tenantId, campaignId, customerId);
    }

    @Override public PageResult<UUID> contacts(UUID tenantId, UUID campaignId, int page, int size) {
        var result = contacts.customerIds(tenantId, campaignId, PageRequest.of(page, size));
        return new PageResult<>(result.getContent(), result.hasNext());
    }

    @Override public List<UUID> eligible(UUID tenantId, UUID campaignId, UUID templateId, UUID after, int limit) {
        return contacts.eligible(tenantId, campaignId, templateId, after, PageRequest.of(0, limit));
    }

    @Override public List<UUID> stillEligible(UUID tenantId, UUID campaignId, UUID templateId, List<UUID> customerIds) {
        if (customerIds.isEmpty()) { return List.of(); }
        return contacts.stillEligible(tenantId, campaignId, templateId, customerIds);
    }

    @Override public void lockDailyQuota(UUID tenantId) {
        // Candado de transacción de PostgreSQL: se libera solo al confirmar o revertir.
        jdbc.query("select pg_advisory_xact_lock(hashtextextended(?, 0))", rows -> { },
                "marketing-daily-quota:" + tenantId);
    }

    @Override public long deliveredSince(UUID tenantId, Instant since) {
        return deliveries.countByTenantIdAndSentAtGreaterThanEqual(tenantId, since);
    }

    @Override public void recordDelivery(UUID tenantId, UUID campaignId, UUID templateId, UUID customerId,
                                         UUID actorId, Instant now) {
        deliveries.saveAndFlush(new DeliveryEntity(tenantId, campaignId, templateId, customerId, actorId, now));
    }
}
