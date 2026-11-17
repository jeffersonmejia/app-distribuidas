package com.erp.features.marketing;

import static com.erp.features.marketing.domain.model.CampaignStatus.*;
import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import com.erp.features.marketing.domain.model.Campaign;
import com.erp.features.marketing.domain.model.CampaignStatus;
import com.erp.features.marketing.domain.model.Template;
import com.erp.features.marketing.domain.service.EmailLayout;
import org.junit.jupiter.api.Test;

//SOLID: SRP — ESTA SUITE COMPRUEBA LAS REGLAS DE DOMINIO DE CAMPAÑAS Y PLANTILLAS.
class MarketingDomainTest {
    private static final UUID ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-11-16T00:00:00Z");
    private static final LocalDate START = LocalDate.parse("2026-11-20");

    @Test void statusesOnlyAdvanceInOrderOrCancelBeforeBeingTerminal() {
        assertTrue(DRAFT.canMoveTo(SCHEDULED));
        assertTrue(SCHEDULED.canMoveTo(ACTIVE));
        assertTrue(ACTIVE.canMoveTo(FINISHED));
        for (CampaignStatus status : new CampaignStatus[]{DRAFT, SCHEDULED, ACTIVE}) {
            assertTrue(status.canMoveTo(CANCELLED));
            assertFalse(status.canMoveTo(status));
            assertFalse(status.canMoveTo(null));
        }
        assertFalse(DRAFT.canMoveTo(ACTIVE));
        assertFalse(SCHEDULED.canMoveTo(DRAFT));
        for (CampaignStatus next : CampaignStatus.values()) {
            assertFalse(FINISHED.canMoveTo(next));
            assertFalse(CANCELLED.canMoveTo(next));
        }
    }

    @Test void campaignRequiresItsFourFieldsAndKeepsAuditOnTransitions() {
        Campaign campaign = Campaign.create(ID, ID, " Black Friday ", " Ofertas ", START, START, ID, NOW);
        assertEquals("Black Friday", campaign.name());
        assertEquals(DRAFT, campaign.status());
        UUID other = UUID.randomUUID();
        Campaign scheduled = campaign.moveTo(SCHEDULED, other, NOW.plusSeconds(1));
        assertEquals(other, scheduled.updatedBy());
        assertEquals(ID, scheduled.createdBy());
        assertThrows(IllegalStateException.class, () -> campaign.moveTo(FINISHED, ID, NOW));
        assertThrows(IllegalArgumentException.class, () -> Campaign.create(ID, ID, " ", "d", START, START, ID, NOW));
        assertThrows(IllegalArgumentException.class, () -> Campaign.create(ID, ID, "n", null, START, START, ID, NOW));
        assertThrows(IllegalArgumentException.class, () -> Campaign.create(ID, ID, "n", "d", null, START, ID, NOW));
        assertThrows(IllegalArgumentException.class, () -> Campaign.create(ID, ID, "n", "d", START, null, ID, NOW));
        assertThrows(IllegalArgumentException.class,
                () -> Campaign.create(ID, ID, "n", "d", START, START.minusDays(1), ID, NOW));
    }

    @Test void templateRequiresSubjectHtmlAndTextAndRejectsActiveContentAndHeaderInjection() {
        Template template = Template.create(ID, ID, "Promo", " Hola ", "<p>Hola</p>", "Hola", ID, NOW);
        assertEquals("Hola", template.subject());
        assertEquals("<b>x</b>", template.update("Promo", "Hola", "<b>x</b>", "x", ID, NOW).htmlBody());
        for (String html : new String[]{null, " ", "<script>alert(1)</script>", "<img src=x onerror=alert(1)>",
                "<a href=\"JavaScript:alert(1)\">x</a>", "< iframe src=x>"}) {
            assertThrows(IllegalArgumentException.class, () -> Template.create(ID, ID, "n", "s", html, "t", ID, NOW));
        }
        assertThrows(IllegalArgumentException.class,
                () -> Template.create(ID, ID, "n", "Hola\r\nBcc: x@example.test", "<p>h</p>", "t", ID, NOW));
        assertThrows(IllegalArgumentException.class, () -> Template.create(ID, ID, "n", "s", "<p>h</p>", " ", ID, NOW));
        assertThrows(IllegalArgumentException.class, () -> Template.create(ID, ID, null, "s", "<p>h</p>", "t", ID, NOW));
    }

    @Test void layoutWrapsBodyWithAppStyleAndEscapesProductName() {
        String html = EmailLayout.wrap("Nexo <ERP>", "<p>Hola</p>");
        assertTrue(html.contains("<p>Hola</p>"));
        assertTrue(html.contains("#2563EB"));
        assertTrue(html.contains("Nexo &lt;ERP&gt;"));
        assertFalse(html.contains("<ERP>"));
    }
}
