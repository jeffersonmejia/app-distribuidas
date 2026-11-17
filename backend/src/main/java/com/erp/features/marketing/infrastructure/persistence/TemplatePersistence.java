package com.erp.features.marketing.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import com.erp.features.marketing.application.port.out.PageResult;
import com.erp.features.marketing.application.port.out.TemplateStore;
import com.erp.features.marketing.domain.model.Template;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

//SOLID: SRP — ESTE ADAPTADOR IMPLEMENTA LA PERSISTENCIA DE PLANTILLAS AISLADA POR TENANT.
@Repository
public class TemplatePersistence implements TemplateStore {
    private final TemplateJpaRepository repository;

    public TemplatePersistence(TemplateJpaRepository repository) { this.repository = repository; }

    @Override public Optional<Template> find(UUID tenantId, UUID id) {
        return repository.findByTenantIdAndId(tenantId, id).map(TemplateEntity::toDomain);
    }

    @Override public Template save(Template template) {
        TemplateEntity entity = repository.findByTenantIdAndId(template.tenantId(), template.id())
                .orElseGet(() -> new TemplateEntity(template));
        entity.apply(template);
        return repository.saveAndFlush(entity).toDomain();
    }

    @Override public PageResult<Template> list(UUID tenantId, int page, int size) {
        var result = repository.search(tenantId, PageRequest.of(page, size));
        return new PageResult<>(result.getContent().stream().map(TemplateEntity::toDomain).toList(), result.hasNext());
    }
}
