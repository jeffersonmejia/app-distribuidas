package com.erp.features.marketing.domain.model;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

//SOLID: SRP — ESTE MODELO PROTEGE EL CONTENIDO DE UNA PLANTILLA REUTILIZABLE DE CORREO.
public record Template(UUID id, UUID tenantId, String name, String subject, String htmlBody, String textBody,
                       Instant createdAt, Instant updatedAt, UUID createdBy, UUID updatedBy) {
    // shortcut: lista de bloqueo de contenido activo, no un sanitizador completo; si el frontend
    // previsualiza el HTML fuera de un iframe sandbox, cambiar a OWASP Java HTML Sanitizer.
    private static final Pattern ACTIVE_CONTENT = Pattern.compile(
            "<\\s*(script|iframe|object|embed|form|link|meta|base)\\b|\\bon\\w+\\s*=|javascript:",
            Pattern.CASE_INSENSITIVE);

    public Template {
        Objects.requireNonNull(id);
        Objects.requireNonNull(tenantId);
        Objects.requireNonNull(createdAt);
        Objects.requireNonNull(updatedAt);
        Objects.requireNonNull(createdBy);
        Objects.requireNonNull(updatedBy);
        if (name == null || name.isBlank() || subject == null || subject.isBlank()
                || htmlBody == null || htmlBody.isBlank() || textBody == null || textBody.isBlank()
                // Un salto de línea en el asunto permitiría inyectar cabeceras de correo.
                || subject.contains("\r") || subject.contains("\n")
                || ACTIVE_CONTENT.matcher(htmlBody).find()) {
            throw new IllegalArgumentException("invalid template");
        }
        name = name.trim();
        subject = subject.trim();
    }

    public static Template create(UUID id, UUID tenantId, String name, String subject, String htmlBody,
                                  String textBody, UUID actorId, Instant now) {
        return new Template(id, tenantId, name, subject, htmlBody, textBody, now, now, actorId, actorId);
    }

    public Template update(String newName, String newSubject, String newHtmlBody, String newTextBody,
                           UUID actorId, Instant now) {
        return new Template(id, tenantId, newName, newSubject, newHtmlBody, newTextBody, createdAt, now,
                createdBy, actorId);
    }
}
