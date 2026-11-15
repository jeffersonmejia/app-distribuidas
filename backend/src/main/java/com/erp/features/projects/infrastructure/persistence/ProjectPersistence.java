package com.erp.features.projects.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import com.erp.features.projects.application.port.out.PageResult;
import com.erp.features.projects.application.port.out.ProjectStore;
import com.erp.features.projects.domain.model.Project;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

//SOLID: SRP — ESTE ADAPTADOR IMPLEMENTA LA PERSISTENCIA DE PROYECTOS AISLADA POR TENANT.
@Repository
public class ProjectPersistence implements ProjectStore {
    private final ProjectJpaRepository repository;

    public ProjectPersistence(ProjectJpaRepository repository) { this.repository = repository; }

    @Override public Optional<Project> find(UUID tenantId, UUID id) {
        return repository.findByTenantIdAndId(tenantId, id).map(ProjectEntity::toDomain);
    }

    @Override public Project save(Project project) {
        ProjectEntity entity = repository.findByTenantIdAndId(project.tenantId(), project.id())
                .orElseGet(() -> new ProjectEntity(project));
        entity.apply(project);
        return repository.saveAndFlush(entity).toDomain();
    }

    @Override public PageResult<Project> search(UUID tenantId, String nameTerm, boolean deleted, int page, int size) {
        var result = repository.search(tenantId, deleted, nameTerm, PageRequest.of(page, size));
        return new PageResult<>(result.getContent().stream().map(ProjectEntity::toDomain).toList(), result.hasNext());
    }

    @Override public void purge(UUID tenantId, UUID id) {
        repository.purge(tenantId, id);
        repository.flush();
    }
}
