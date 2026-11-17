package com.erp.features.marketing.application.port.out;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import com.erp.features.marketing.domain.model.ConsentStatus;

//SOLID: DIP — ESTE PUERTO SEPARA LOS CASOS DE USO DE CONSENTIMIENTO DE SU PERSISTENCIA.
public interface ConsentStore {
    /** Solo incluye clientes con preferencia registrada; la ausencia significa sin consentimiento. */
    Map<UUID, ConsentStatus> statuses(UUID tenantId, List<UUID> customerIds);
    void save(UUID tenantId, UUID customerId, ConsentStatus status, UUID actorId, Instant now);
}
