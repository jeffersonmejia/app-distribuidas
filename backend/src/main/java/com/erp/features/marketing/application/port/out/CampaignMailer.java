package com.erp.features.marketing.application.port.out;

//SOLID: DIP — ESTE PUERTO SEPARA EL ENVÍO DE CAMPAÑAS DEL PROVEEDOR DE CORREO.
public interface CampaignMailer {
    /** Lanza RuntimeException si el proveedor rechaza o no puede entregar el mensaje. */
    void send(String to, String subject, String html, String text);
}
