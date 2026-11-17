package com.erp.features.marketing.application.usecase;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.erp.features.crm.api.ActiveCustomers;
import com.erp.features.marketing.application.port.out.ConsentStore;
import com.erp.features.marketing.domain.model.ConsentStatus;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantId;
import org.springframework.stereotype.Service;

//SOLID: SRP — ESTE SERVICIO REGISTRA EL CONSENTIMIENTO Y LAS BAJAS QUE ADMINISTRA MARKETING.
@Service
public class ConsentService {
    static final String MANAGE = "marketing:consents:manage";
    private final TenantAccess access;
    private final ConsentStore consents;
    private final ActiveCustomers crm;

    public ConsentService(TenantAccess access, ConsentStore consents, ActiveCustomers crm) {
        this.access = access;
        this.consents = consents;
        this.crm = crm;
    }

    /** Una baja registrada es definitiva desde esta API: el consentimiento no la revierte. */
    public void consent(TenantId tenant, UUID customerId) {
        if (crm.findActive(tenant, List.of(customerId)).isEmpty()) { throw new MarketingException("CONTACT_NOT_FOUND"); }
        access.execute(tenant, MANAGE, context -> {
            UUID tenantId = context.tenantId().value();
            if (consents.statuses(tenantId, List.of(customerId)).get(customerId) == ConsentStatus.UNSUBSCRIBED) {
                throw new MarketingException("CONTACT_UNSUBSCRIBED");
            }
            consents.save(tenantId, customerId, ConsentStatus.CONSENTED, context.actorId().value(), Instant.now());
            return null;
        });
    }

    /** No exige que el cliente siga activo en CRM: una baja siempre debe poder registrarse. */
    public void unsubscribe(TenantId tenant, UUID customerId) {
        access.execute(tenant, MANAGE, context -> {
            consents.save(context.tenantId().value(), customerId, ConsentStatus.UNSUBSCRIBED,
                    context.actorId().value(), Instant.now());
            return null;
        });
    }
}
