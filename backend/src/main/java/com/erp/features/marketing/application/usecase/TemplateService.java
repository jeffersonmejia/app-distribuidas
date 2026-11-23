package com.erp.features.marketing.application.usecase;

import java.time.Instant;
import java.util.UUID;
import com.erp.features.marketing.application.dto.PageView;
import com.erp.features.marketing.application.dto.TemplateInput;
import com.erp.features.marketing.application.dto.TemplateView;
import com.erp.features.marketing.application.port.out.PageResult;
import com.erp.features.marketing.application.port.out.TemplateStore;
import com.erp.features.marketing.domain.model.Template;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantId;
import org.springframework.stereotype.Service;

//SOLID: SRP — ESTE SERVICIO COORDINA LOS CASOS DE USO AUTORIZADOS DE PLANTILLAS.
@Service
public class TemplateService {
    static final String READ = "marketing:templates:read";
    static final String MANAGE = "marketing:templates:manage";
    private final TenantAccess access;
    private final TemplateStore templates;

    public TemplateService(TenantAccess access, TemplateStore templates) {
        this.access = access;
        this.templates = templates;
    }

    public TemplateView create(TenantId tenant, TemplateInput input) {
        validateLength(input);
        return access.execute(tenant, MANAGE, context -> {
            try {
                return view(templates.save(Template.create(UUID.randomUUID(), context.tenantId().value(),
                        input.name(), input.subject(), input.htmlBody(), input.textBody(),
                        context.actorId().value(), Instant.now())));
            } catch (IllegalArgumentException exception) {
                throw new MarketingException("INVALID_TEMPLATE_DATA");
            }
        });
    }

    public TemplateView update(TenantId tenant, UUID id, TemplateInput input) {
        validateLength(input);
        return access.execute(tenant, MANAGE, context -> {
            Template template = find(context.tenantId().value(), id);
            try {
                return view(templates.save(template.update(input.name(), input.subject(), input.htmlBody(),
                        input.textBody(), context.actorId().value(), Instant.now())));
            } catch (IllegalArgumentException exception) {
                throw new MarketingException("INVALID_TEMPLATE_DATA");
            }
        });
    }

    public PageView<TemplateView> list(TenantId tenant, int page, int size) {
        CampaignService.checkPage(page, size);
        return access.execute(tenant, READ, context -> {
            PageResult<Template> result = templates.list(context.tenantId().value(), page, size);
            return new PageView<>(result.items().stream().map(TemplateService::view).toList(), page, size,
                    result.hasNext());
        });
    }

    public TemplateView get(TenantId tenant, UUID id) {
        return access.execute(tenant, READ, context -> view(find(context.tenantId().value(), id)));
    }

    private Template find(UUID tenantId, UUID id) {
        return templates.find(tenantId, id).orElseThrow(() -> new MarketingException("TEMPLATE_NOT_FOUND"));
    }

    private static void validateLength(TemplateInput input) {
        if (input == null || CampaignService.tooLong(input.htmlBody(), 100000)
                || CampaignService.tooLong(input.textBody(), 50000)) {
            throw new MarketingException("INVALID_TEMPLATE_DATA");
        }
    }

    private static TemplateView view(Template t) {
        return new TemplateView(t.id(), t.name(), t.subject(), t.htmlBody(), t.textBody(), t.createdAt(), t.updatedAt());
    }
}
