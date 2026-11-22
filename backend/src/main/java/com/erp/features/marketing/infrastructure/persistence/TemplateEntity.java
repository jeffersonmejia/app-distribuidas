package com.erp.features.marketing.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import com.erp.features.marketing.domain.model.Template;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

//SOLID: SRP — ESTA ENTIDAD REPRESENTA LA PERSISTENCIA DE UNA PLANTILLA DE CORREO.
@Entity
@Table(name = "marketing_template")
public class TemplateEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(nullable = false, columnDefinition = "text") String name;
    @Column(nullable = false, columnDefinition = "text") String subject;
    @Column(name = "html_body", nullable = false, columnDefinition = "text") String htmlBody;
    @Column(name = "text_body", nullable = false, columnDefinition = "text") String textBody;
    @Column(name = "created_at", nullable = false, updatable = false) Instant createdAt;
    @Column(name = "updated_at", nullable = false) Instant updatedAt;
    @Column(name = "created_by", nullable = false, updatable = false) UUID createdBy;
    @Column(name = "updated_by", nullable = false) UUID updatedBy;

    protected TemplateEntity() { }

    TemplateEntity(Template template) { apply(template); }

    void apply(Template template) {
        id = template.id();
        tenantId = template.tenantId();
        name = template.name();
        subject = template.subject();
        htmlBody = template.htmlBody();
        textBody = template.textBody();
        createdAt = template.createdAt();
        updatedAt = template.updatedAt();
        createdBy = template.createdBy();
        updatedBy = template.updatedBy();
    }

    Template toDomain() {
        return new Template(id, tenantId, name, subject, htmlBody, textBody, createdAt, updatedAt, createdBy, updatedBy);
    }
}
