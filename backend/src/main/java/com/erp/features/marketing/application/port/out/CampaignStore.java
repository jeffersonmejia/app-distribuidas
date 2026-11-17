package com.erp.features.marketing.application.port.out;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.erp.features.marketing.domain.model.Campaign;
import com.erp.features.marketing.domain.model.CampaignStatus;

//SOLID: DIP — ESTE PUERTO SEPARA LOS CASOS DE USO DE CAMPAÑAS DE SU PERSISTENCIA.
public interface CampaignStore {
    Optional<Campaign> find(UUID tenantId, UUID id);
    Campaign save(Campaign campaign);
    PageResult<Campaign> list(UUID tenantId, CampaignStatus status, int page, int size);
    void addContact(UUID tenantId, UUID campaignId, UUID customerId, UUID actorId, Instant now);
    void removeContact(UUID tenantId, UUID campaignId, UUID customerId);
    PageResult<UUID> contacts(UUID tenantId, UUID campaignId, int page, int size);
    /** Contactos de la campaña con consentimiento vigente y sin entrega previa de la plantilla, después del cursor. */
    List<UUID> eligible(UUID tenantId, UUID campaignId, UUID templateId, UUID after, int limit);
    List<UUID> stillEligible(UUID tenantId, UUID campaignId, UUID templateId, List<UUID> customerIds);
    /** Serializa los envíos del tenant hasta el fin de la transacción para que el límite diario no se exceda. */
    void lockDailyQuota(UUID tenantId);
    long deliveredSince(UUID tenantId, Instant since);
    void recordDelivery(UUID tenantId, UUID campaignId, UUID templateId, UUID customerId, UUID actorId, Instant now);
}
