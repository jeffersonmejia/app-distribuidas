package com.erp.features.marketing.application.usecase;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import com.erp.features.crm.api.ActiveCustomers;
import com.erp.features.crm.api.MarketingCustomer;
import com.erp.features.identity.api.ActorId;
import com.erp.features.marketing.application.dto.CampaignInput;
import com.erp.features.marketing.application.dto.SendResult;
import com.erp.features.marketing.application.dto.TemplateInput;
import com.erp.features.marketing.application.port.out.CampaignMailer;
import com.erp.features.marketing.application.port.out.CampaignStore;
import com.erp.features.marketing.application.port.out.ConsentStore;
import com.erp.features.marketing.application.port.out.PageResult;
import com.erp.features.marketing.application.port.out.TemplateStore;
import com.erp.features.marketing.domain.model.Campaign;
import com.erp.features.marketing.domain.model.CampaignStatus;
import com.erp.features.marketing.domain.model.ConsentStatus;
import com.erp.features.marketing.domain.model.Template;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantContext;
import com.erp.features.tenancy.api.TenantId;
import com.erp.features.tenancy.api.TenantOperation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

//SOLID: SRP — ESTA SUITE COMPRUEBA LOS CASOS DE USO DE MARKETING, SUS PERMISOS Y LAS REGLAS DE ENVÍO.
class MarketingServicesTest {
    private static final Instant NOW = Instant.parse("2026-11-16T00:00:00Z");
    private static final LocalDate DAY = LocalDate.parse("2026-11-20");
    private final TenantAccess access = mock(TenantAccess.class);
    private final CampaignStore campaigns = mock(CampaignStore.class);
    private final TemplateStore templates = mock(TemplateStore.class);
    private final ConsentStore consents = mock(ConsentStore.class);
    private final ActiveCustomers crm = mock(ActiveCustomers.class);
    private final CampaignMailer mailer = mock(CampaignMailer.class);
    private final TenantId tenant = new TenantId(UUID.randomUUID());
    private final ActorId actor = new ActorId(UUID.randomUUID());
    private final UUID a = new UUID(0, 1);
    private final UUID b = new UUID(0, 2);
    private final UUID c = new UUID(0, 3);
    private final CampaignService campaignService = new CampaignService(access, campaigns, consents, crm);
    private final TemplateService templateService = new TemplateService(access, templates);
    private final ConsentService consentService = new ConsentService(access, consents, crm);
    private final CampaignSendService sendService =
            new CampaignSendService(access, campaigns, templates, crm, mailer, 2, "Nexo ERP");
    private Campaign active;
    private Template template;

    @BeforeEach void setup() {
        when(access.execute(any(), anyString(), any())).thenAnswer(invocation -> {
            TenantOperation<?> operation = invocation.getArgument(2);
            return operation.apply(new TenantContext(invocation.getArgument(0), actor));
        });
        when(campaigns.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(templates.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        active = Campaign.create(UUID.randomUUID(), tenant.value(), "Promo", "Desc", DAY, DAY, actor.value(), NOW)
                .moveTo(CampaignStatus.SCHEDULED, actor.value(), NOW).moveTo(CampaignStatus.ACTIVE, actor.value(), NOW);
        template = Template.create(UUID.randomUUID(), tenant.value(), "T", "Asunto", "<p>Hola</p>", "Hola",
                actor.value(), NOW);
        when(campaigns.find(tenant.value(), active.id())).thenReturn(Optional.of(active));
        when(templates.find(tenant.value(), template.id())).thenReturn(Optional.of(template));
    }

    @Test void campaignsAreCreatedAsDraftAndMoveOnlyThroughApprovedTransitions() {
        assertEquals("DRAFT", campaignService.create(tenant, new CampaignInput("Promo", "Desc", DAY, DAY)).status());
        verify(access).execute(eq(tenant), eq("marketing:campaigns:manage"), any());
        assertEquals("INVALID_CAMPAIGN_DATA", code(() -> campaignService.create(tenant,
                new CampaignInput("Promo", " ", DAY, DAY))));
        assertEquals("INVALID_CAMPAIGN_DATA", code(() -> campaignService.create(tenant, null)));
        assertEquals("FINISHED", campaignService.changeStatus(tenant, active.id(), CampaignStatus.FINISHED).status());
        assertEquals("INVALID_CAMPAIGN_TRANSITION",
                code(() -> campaignService.changeStatus(tenant, active.id(), CampaignStatus.DRAFT)));
        assertEquals("CAMPAIGN_NOT_FOUND", code(() -> campaignService.get(tenant, UUID.randomUUID())));
    }

    @Test void listsAreLimitedToFiveAndReadTheAuthorizedTenant() {
        when(campaigns.list(tenant.value(), null, 0, 5)).thenReturn(new PageResult<>(List.of(active), true));
        assertTrue(campaignService.list(tenant, null, 0, 5).hasNext());
        when(templates.list(tenant.value(), 0, 5)).thenReturn(new PageResult<>(List.of(template), false));
        assertEquals(1, templateService.list(tenant, 0, 5).items().size());
        assertEquals("INVALID_PAGE", code(() -> campaignService.list(tenant, null, 0, 6)));
        assertEquals("INVALID_PAGE", code(() -> campaignService.contacts(tenant, active.id(), -1, 5)));
        assertEquals("INVALID_PAGE", code(() -> templateService.list(tenant, 0, 0)));
    }

    @Test void contactsComeFromCrmPublicApiAndShowMarketingConsent() {
        when(crm.findActive(tenant, List.of(a))).thenReturn(List.of(customer(a)));
        campaignService.addContact(tenant, active.id(), a);
        verify(campaigns).addContact(eq(tenant.value()), eq(active.id()), eq(a), eq(actor.value()), any());
        assertEquals("CONTACT_NOT_FOUND", code(() -> campaignService.addContact(tenant, active.id(), b)));
        campaignService.removeContact(tenant, active.id(), a);
        verify(campaigns).removeContact(tenant.value(), active.id(), a);

        // b está inactivo en CRM y no aparece; c no tiene preferencia registrada.
        when(campaigns.contacts(tenant.value(), active.id(), 0, 5)).thenReturn(new PageResult<>(List.of(a, b, c), false));
        when(consents.statuses(tenant.value(), List.of(a, b, c))).thenReturn(Map.of(a, ConsentStatus.UNSUBSCRIBED));
        when(crm.findActive(tenant, List.of(a, b, c))).thenReturn(List.of(customer(c), customer(a)));
        var page = campaignService.contacts(tenant, active.id(), 0, 5);
        assertEquals(List.of(a, c), page.items().stream().map(item -> item.customerId()).toList());
        assertEquals(List.of("UNSUBSCRIBED", "NONE"), page.items().stream().map(item -> item.consent()).toList());
    }

    @Test void consentNeedsAnActiveCustomerAndNeverRevertsAnUnsubscription() {
        assertEquals("CONTACT_NOT_FOUND", code(() -> consentService.consent(tenant, a)));
        when(crm.findActive(tenant, List.of(a))).thenReturn(List.of(customer(a)));
        when(consents.statuses(tenant.value(), List.of(a))).thenReturn(Map.of());
        consentService.consent(tenant, a);
        verify(consents).save(eq(tenant.value()), eq(a), eq(ConsentStatus.CONSENTED), eq(actor.value()), any());
        consentService.unsubscribe(tenant, a);
        verify(consents).save(eq(tenant.value()), eq(a), eq(ConsentStatus.UNSUBSCRIBED), eq(actor.value()), any());
        when(consents.statuses(tenant.value(), List.of(a))).thenReturn(Map.of(a, ConsentStatus.UNSUBSCRIBED));
        assertEquals("CONTACT_UNSUBSCRIBED", code(() -> consentService.consent(tenant, a)));
        verify(access, times(3)).execute(eq(tenant), eq("marketing:consents:manage"), any());
    }

    @Test void templatesValidateContentOnCreateAndUpdate() {
        assertEquals("Asunto", templateService.create(tenant, new TemplateInput("T", "Asunto", "<p>x</p>", "x")).subject());
        assertEquals("INVALID_TEMPLATE_DATA", code(() -> templateService.create(tenant,
                new TemplateInput("T", "Asunto", "<script>x</script>", "x"))));
        assertEquals("INVALID_TEMPLATE_DATA", code(() -> templateService.create(tenant, null)));
        assertEquals("Nuevo", templateService.update(tenant, template.id(),
                new TemplateInput("T", "Nuevo", "<p>x</p>", "x")).subject());
        assertEquals("INVALID_TEMPLATE_DATA", code(() -> templateService.update(tenant, template.id(),
                new TemplateInput("T", "Nuevo", "<p>x</p>", null))));
        assertEquals("INVALID_TEMPLATE_DATA", code(() -> templateService.update(tenant, template.id(), null)));
        assertEquals("TEMPLATE_NOT_FOUND", code(() -> templateService.get(tenant, UUID.randomUUID())));
        assertEquals(template.id(), templateService.get(tenant, template.id()).id());
    }

    @Test void sendDeliversOnlyToEligibleActiveContactsWithinTheDailyLimit() {
        // b fue desactivado en CRM y un cliente sin email no recibe correo.
        UUID noEmail = new UUID(0, 4);
        when(campaigns.eligible(eq(tenant.value()), eq(active.id()), eq(template.id()), eq(new UUID(0, 0)), eq(2)))
                .thenReturn(List.of(a, b));
        when(campaigns.eligible(eq(tenant.value()), eq(active.id()), eq(template.id()), eq(b), eq(2)))
                .thenReturn(List.of(c, noEmail));
        when(crm.findActive(tenant, List.of(a, b))).thenReturn(List.of(customer(a)));
        when(crm.findActive(tenant, List.of(c, noEmail))).thenReturn(List.of(customer(c),
                new MarketingCustomer(noEmail, "Sin correo", null, null)));
        when(campaigns.stillEligible(tenant.value(), active.id(), template.id(), List.of(a, c))).thenReturn(List.of(a, c));
        when(campaigns.deliveredSince(eq(tenant.value()), any())).thenReturn(1L);

        SendResult result = sendService.send(tenant, active.id(), template.id());

        assertEquals(new SendResult(1, 0, 0), result);
        verify(campaigns).lockDailyQuota(tenant.value());
        verify(mailer).send(eq(a + "@example.test"), eq("Asunto"), contains("<p>Hola</p>"), eq("Hola"));
        verifyNoMoreInteractions(mailer);
        verify(campaigns).recordDelivery(eq(tenant.value()), eq(active.id()), eq(template.id()), eq(a),
                eq(actor.value()), any());
        verify(access, atLeastOnce()).execute(eq(tenant), eq("marketing:campaigns:send"), any());
    }

    @Test void sendStopsWhenLimitIsReachedCampaignIsNotActiveOrProviderFails() {
        when(campaigns.eligible(any(), any(), any(), eq(new UUID(0, 0)), anyInt())).thenReturn(List.of(a, b));
        when(crm.findActive(tenant, List.of(a, b))).thenReturn(List.of(customer(a), customer(b)));
        when(campaigns.stillEligible(any(), any(), any(), any())).thenReturn(List.of(a, b));
        when(campaigns.deliveredSince(any(), any())).thenReturn(2L);
        assertEquals("DAILY_LIMIT_REACHED", code(() -> sendService.send(tenant, active.id(), template.id())));
        verifyNoInteractions(mailer);

        // Un fallo parcial no impide registrar las entregas correctas; un fallo total se informa como error.
        when(campaigns.deliveredSince(any(), any())).thenReturn(0L);
        doThrow(new IllegalStateException("smtp")).when(mailer).send(eq(a + "@example.test"), any(), any(), any());
        assertEquals(new SendResult(1, 1, 1), sendService.send(tenant, active.id(), template.id()));
        verify(campaigns, never()).recordDelivery(any(), any(), any(), eq(a), any(), any());
        doThrow(new IllegalStateException("smtp")).when(mailer).send(any(), any(), any(), any());
        assertEquals("MAIL_PROVIDER_ERROR", code(() -> sendService.send(tenant, active.id(), template.id())));

        Campaign draft = Campaign.create(UUID.randomUUID(), tenant.value(), "P", "D", DAY, DAY, actor.value(), NOW);
        when(campaigns.find(tenant.value(), draft.id())).thenReturn(Optional.of(draft));
        assertEquals("CAMPAIGN_NOT_ACTIVE", code(() -> sendService.send(tenant, draft.id(), template.id())));
        assertEquals("TEMPLATE_NOT_FOUND", code(() -> sendService.send(tenant, active.id(), UUID.randomUUID())));
        assertEquals("INVALID_REQUEST", code(() -> sendService.send(tenant, active.id(), null)));
    }

    @Test void authorizationPrecedesAnyMarketingDataAccess() {
        reset(access);
        doThrow(new AccessDeniedException("denied")).when(access).execute(eq(tenant), anyString(), any());
        assertThrows(AccessDeniedException.class, () -> campaignService.get(tenant, active.id()));
        assertThrows(AccessDeniedException.class, () -> templateService.get(tenant, template.id()));
        assertThrows(AccessDeniedException.class, () -> consentService.unsubscribe(tenant, a));
        assertThrows(AccessDeniedException.class, () -> sendService.send(tenant, active.id(), template.id()));
        verifyNoInteractions(campaigns, templates, consents, mailer);
    }

    private static MarketingCustomer customer(UUID id) {
        return new MarketingCustomer(id, "Cliente", id + "@example.test", null);
    }

    private static String code(Runnable action) {
        return assertThrows(MarketingException.class, action::run).code();
    }
}
