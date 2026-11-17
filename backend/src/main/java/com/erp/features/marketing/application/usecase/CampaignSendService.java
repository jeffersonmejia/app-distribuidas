package com.erp.features.marketing.application.usecase;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import com.erp.features.crm.api.ActiveCustomers;
import com.erp.features.crm.api.MarketingCustomer;
import com.erp.features.marketing.application.dto.SendResult;
import com.erp.features.marketing.application.port.out.CampaignMailer;
import com.erp.features.marketing.application.port.out.CampaignStore;
import com.erp.features.marketing.application.port.out.TemplateStore;
import com.erp.features.marketing.domain.model.CampaignStatus;
import com.erp.features.marketing.domain.model.Template;
import com.erp.features.marketing.domain.service.EmailLayout;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

//SOLID: SRP — ESTE SERVICIO EJECUTA EL ENVÍO MANUAL DE UNA CAMPAÑA RESPETANDO CONSENTIMIENTO Y LÍMITE DIARIO.
@Service
public class CampaignSendService {
    static final String SEND = "marketing:campaigns:send";
    private static final UUID FIRST = new UUID(0, 0);
    private static final Logger log = LoggerFactory.getLogger(CampaignSendService.class);
    private final TenantAccess access;
    private final CampaignStore campaigns;
    private final TemplateStore templates;
    private final ActiveCustomers crm;
    private final CampaignMailer mailer;
    private final int dailyLimit;
    private final String productName;

    public CampaignSendService(TenantAccess access, CampaignStore campaigns, TemplateStore templates,
                               ActiveCustomers crm, CampaignMailer mailer,
                               @Value("${marketing.mail.daily-limit:20}") int dailyLimit,
                               @Value("${spring.application.name:Nexo ERP}") String productName) {
        this.access = access;
        this.campaigns = campaigns;
        this.templates = templates;
        this.crm = crm;
        this.mailer = mailer;
        this.dailyLimit = dailyLimit;
        this.productName = productName;
    }

    /** Envío manual: solo campañas activas, contactos activos en CRM con consentimiento y sin baja. */
    public SendResult send(TenantId tenant, UUID campaignId, UUID templateId) {
        if (templateId == null) { throw new MarketingException("INVALID_REQUEST"); }
        Template template = access.execute(tenant, SEND, context -> {
            requireActive(context.tenantId().value(), campaignId);
            return templates.find(context.tenantId().value(), templateId)
                    .orElseThrow(() -> new MarketingException("TEMPLATE_NOT_FOUND"));
        });
        // CRM se consulta fuera de la transacción de Marketing, por lotes acotados al límite diario.
        Map<UUID, MarketingCustomer> recipients = new LinkedHashMap<>();
        UUID cursor = FIRST;
        while (recipients.size() < dailyLimit) {
            UUID after = cursor;
            List<UUID> ids = access.execute(tenant, SEND, context -> campaigns.eligible(
                    context.tenantId().value(), campaignId, templateId, after, dailyLimit));
            if (ids.isEmpty()) { break; }
            crm.findActive(tenant, ids).stream().filter(customer -> customer.email() != null)
                    .forEach(customer -> recipients.put(customer.id(), customer));
            cursor = ids.get(ids.size() - 1);
        }
        String html = EmailLayout.wrap(productName, template.htmlBody());
        // shortcut: la transacción queda abierta durante el SMTP (máx. 20 correos con timeout de 10 s) y un
        // fallo al confirmar dejaría correos enviados sin registrar; pasar a reserva + confirmación si el límite sube.
        return access.execute(tenant, SEND, context -> {
            UUID tenantId = context.tenantId().value();
            requireActive(tenantId, campaignId);
            campaigns.lockDailyQuota(tenantId);
            Instant today = LocalDate.now(ZoneOffset.UTC).atStartOfDay(ZoneOffset.UTC).toInstant();
            long remaining = dailyLimit - campaigns.deliveredSince(tenantId, today);
            if (remaining <= 0) { throw new MarketingException("DAILY_LIMIT_REACHED"); }
            int sent = 0;
            int failed = 0;
            // Se vuelve a comprobar dentro del candado: una baja o un envío concurrente excluyen al contacto.
            for (UUID customerId : campaigns.stillEligible(tenantId, campaignId, templateId,
                    List.copyOf(recipients.keySet()))) {
                if (sent >= remaining) { break; }
                try {
                    mailer.send(recipients.get(customerId).email(), template.subject(), html, template.textBody());
                } catch (RuntimeException exception) {
                    failed++;
                    // Sin dirección ni mensaje del proveedor: pueden contener datos personales.
                    log.warn("marketing mail failed campaign={} customer={} error={}", campaignId, customerId,
                            exception.getClass().getSimpleName());
                    continue;
                }
                campaigns.recordDelivery(tenantId, campaignId, templateId, customerId,
                        context.actorId().value(), Instant.now());
                sent++;
            }
            if (sent == 0 && failed > 0) { throw new MarketingException("MAIL_PROVIDER_ERROR"); }
            return new SendResult(sent, failed, remaining - sent);
        });
    }

    private void requireActive(UUID tenantId, UUID campaignId) {
        CampaignStatus status = campaigns.find(tenantId, campaignId)
                .orElseThrow(() -> new MarketingException("CAMPAIGN_NOT_FOUND")).status();
        if (status != CampaignStatus.ACTIVE) { throw new MarketingException("CAMPAIGN_NOT_ACTIVE"); }
    }
}
