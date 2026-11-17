package com.erp.features.marketing.domain.service;

//SOLID: SRP — ESTA CLASE ENVUELVE EL CUERPO DE UNA PLANTILLA CON EL ESTILO E ICONOGRAFÍA DE LA APP.
public final class EmailLayout {
    private EmailLayout() { }

    /** Colores, radio y tipografía tomados de frontend/src/theme/tokens.css; estilos en línea para clientes de correo. */
    public static String wrap(String productName, String bodyHtml) {
        String product = productName.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
        return """
                <!doctype html>
                <html lang="es"><body style="margin:0;padding:24px;background:#EEF2F6;font-family:Urbanist,Segoe UI,Arial,sans-serif;color:#111827">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"><tr><td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden">
                <tr><td style="padding:16px 24px;background:#2563EB;color:#ffffff;font-size:18px;font-weight:700">
                <span style="display:inline-block;width:32px;height:32px;line-height:32px;margin-right:8px;text-align:center;background:rgba(255,255,255,.15);border-radius:8px" aria-hidden="true">&#9993;</span>%s</td></tr>
                <tr><td style="padding:24px;font-size:16px;line-height:1.5">%s</td></tr>
                <tr><td style="padding:16px 24px;background:#F1F5F9;color:#6B7280;font-size:12px">Recibes este correo porque diste tu consentimiento a %s. Para darte de baja, responde a este mensaje.</td></tr>
                </table></td></tr></table></body></html>
                """.formatted(product, bodyHtml, product);
    }
}
