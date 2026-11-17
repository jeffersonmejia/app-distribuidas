package com.erp.features.marketing.application.port.out;

import java.util.Optional;
import java.util.UUID;
import com.erp.features.marketing.domain.model.Template;

//SOLID: DIP — ESTE PUERTO SEPARA LOS CASOS DE USO DE PLANTILLAS DE SU PERSISTENCIA.
public interface TemplateStore {
    Optional<Template> find(UUID tenantId, UUID id);
    Template save(Template template);
    PageResult<Template> list(UUID tenantId, int page, int size);
}
