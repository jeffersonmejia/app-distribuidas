package com.erp.features.marketing.application.usecase;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import com.erp.features.crm.api.ActiveCustomers;
import com.erp.features.crm.api.MarketingCustomer;
import com.erp.features.marketing.application.dto.CampaignInput;
import com.erp.features.marketing.application.dto.CampaignView;
import com.erp.features.marketing.application.dto.ContactView;
import com.erp.features.marketing.application.dto.PageView;
import com.erp.features.marketing.application.port.out.CampaignStore;
import com.erp.features.marketing.application.port.out.ConsentStore;
import com.erp.features.marketing.application.port.out.PageResult;
import com.erp.features.marketing.domain.model.Campaign;
import com.erp.features.marketing.domain.model.CampaignStatus;
import com.erp.features.marketing.domain.model.ConsentStatus;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantId;
import org.springframework.stereotype.Service;

//SOLID: SRP — ESTE SERVICIO COORDINA LOS CASOS DE USO AUTORIZADOS DE CAMPAÑAS Y SUS CONTACTOS.
@Service
public class CampaignService {
    static final String READ = "marketing:campaigns:read";
    static final String MANAGE = "marketing:campaigns:manage";
    static final int MAX_PAGE_SIZE = 5;
    private final TenantAccess access;
    private final CampaignStore campaigns;
    private final ConsentStore consents;
    private final ActiveCustomers crm;

    public CampaignService(TenantAccess access, CampaignStore campaigns, ConsentStore consents, ActiveCustomers crm) {
        this.access = access;
        this.campaigns = campaigns;
        this.consents = consents;
        this.crm = crm;
    }

    public CampaignView create(TenantId tenant, CampaignInput input) {
        if (input == null) { throw new MarketingException("INVALID_CAMPAIGN_DATA"); }
        return access.execute(tenant, MANAGE, context -> {
            try {
                return view(campaigns.save(Campaign.create(UUID.randomUUID(), context.tenantId().value(),
                        input.name(), input.description(), input.startDate(), input.endDate(),
                        context.actorId().value(), Instant.now())));
            } catch (IllegalArgumentException exception) {
                throw new MarketingException("INVALID_CAMPAIGN_DATA");
            }
        });
    }

    public PageView<CampaignView> list(TenantId tenant, CampaignStatus status, int page, int size) {
        checkPage(page, size);
        return access.execute(tenant, READ, context -> {
            PageResult<Campaign> result = campaigns.list(context.tenantId().value(), status, page, size);
            return new PageView<>(result.items().stream().map(CampaignService::view).toList(), page, size,
                    result.hasNext());
        });
    }

    public CampaignView get(TenantId tenant, UUID id) {
        return access.execute(tenant, READ, context -> view(find(context.tenantId().value(), id)));
    }

    public CampaignView changeStatus(TenantId tenant, UUID id, CampaignStatus status) {
        return access.execute(tenant, MANAGE, context -> {
            try {
                return view(campaigns.save(find(context.tenantId().value(), id)
                        .moveTo(status, context.actorId().value(), Instant.now())));
            } catch (IllegalStateException exception) {
                throw new MarketingException("INVALID_CAMPAIGN_TRANSITION");
            }
        });
    }

    public void addContact(TenantId tenant, UUID id, UUID customerId) {
        // CRM se consulta por su API pública y fuera de la transacción de Marketing.
        if (crm.findActive(tenant, List.of(customerId)).isEmpty()) { throw new MarketingException("CONTACT_NOT_FOUND"); }
        access.execute(tenant, MANAGE, context -> {
            UUID tenantId = context.tenantId().value();
            campaigns.addContact(tenantId, find(tenantId, id).id(), customerId, context.actorId().value(), Instant.now());
            return null;
        });
    }

    public void removeContact(TenantId tenant, UUID id, UUID customerId) {
        access.execute(tenant, MANAGE, context -> {
            UUID tenantId = context.tenantId().value();
            campaigns.removeContact(tenantId, find(tenantId, id).id(), customerId);
            return null;
        });
    }

    /** Solo devuelve contactos activos en CRM; una página puede traer menos elementos si alguno fue desactivado. */
    public PageView<ContactView> contacts(TenantId tenant, UUID id, int page, int size) {
        checkPage(page, size);
        record Selection(PageResult<UUID> ids, Map<UUID, ConsentStatus> consent) { }
        Selection selection = access.execute(tenant, READ, context -> {
            UUID tenantId = context.tenantId().value();
            PageResult<UUID> ids = campaigns.contacts(tenantId, find(tenantId, id).id(), page, size);
            return new Selection(ids, consents.statuses(tenantId, ids.items()));
        });
        Map<UUID, MarketingCustomer> active = crm.findActive(tenant, selection.ids().items()).stream()
                .collect(Collectors.toMap(MarketingCustomer::id, Function.identity()));
        List<ContactView> items = selection.ids().items().stream().filter(active::containsKey)
                .map(customerId -> new ContactView(customerId, active.get(customerId).fullName(),
                        active.get(customerId).email(), selection.consent().containsKey(customerId)
                        ? selection.consent().get(customerId).name() : "NONE"))
                .toList();
        return new PageView<>(items, page, size, selection.ids().hasNext());
    }

    static void checkPage(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) { throw new MarketingException("INVALID_PAGE"); }
    }

    private Campaign find(UUID tenantId, UUID id) {
        return campaigns.find(tenantId, id).orElseThrow(() -> new MarketingException("CAMPAIGN_NOT_FOUND"));
    }

    private static CampaignView view(Campaign c) {
        return new CampaignView(c.id(), c.name(), c.description(), c.startDate(), c.endDate(), c.status().name(),
                c.createdAt(), c.updatedAt());
    }
}
