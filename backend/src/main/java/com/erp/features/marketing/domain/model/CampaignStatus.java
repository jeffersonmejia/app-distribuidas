package com.erp.features.marketing.domain.model;

//SOLID: SRP — ESTE ENUM DEFINE LOS ESTADOS DE CAMPAÑA Y SUS TRANSICIONES MANUALES.
public enum CampaignStatus {
    DRAFT, SCHEDULED, ACTIVE, FINISHED, CANCELLED;

    /** Borrador → Programada → Activa → Finalizada; Cancelada desde cualquier estado no terminal. */
    public boolean canMoveTo(CampaignStatus next) {
        if (next == null || this == FINISHED || this == CANCELLED) { return false; }
        return next == CANCELLED || next.ordinal() == ordinal() + 1;
    }
}
