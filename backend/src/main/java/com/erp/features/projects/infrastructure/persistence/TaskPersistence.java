package com.erp.features.projects.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import com.erp.features.projects.application.port.out.PageResult;
import com.erp.features.projects.application.port.out.TaskStore;
import com.erp.features.projects.domain.model.Task;
import com.erp.features.projects.domain.model.TaskStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

//SOLID: SRP — ESTE ADAPTADOR IMPLEMENTA LA PERSISTENCIA DE TAREAS AISLADA POR TENANT.
@Repository
public class TaskPersistence implements TaskStore {
    private final TaskJpaRepository repository;

    public TaskPersistence(TaskJpaRepository repository) { this.repository = repository; }

    @Override public Optional<Task> find(UUID tenantId, UUID projectId, UUID id) {
        return repository.findByTenantIdAndProjectIdAndId(tenantId, projectId, id).map(TaskEntity::toDomain);
    }

    @Override public Task save(Task task) {
        TaskEntity entity = repository.findByTenantIdAndProjectIdAndId(task.tenantId(), task.projectId(), task.id())
                .orElseGet(() -> new TaskEntity(task));
        entity.apply(task);
        return repository.saveAndFlush(entity).toDomain();
    }

    @Override public PageResult<Task> search(UUID tenantId, UUID projectId, TaskStatus status, boolean deleted,
                                             int page, int size) {
        var result = repository.search(tenantId, projectId, status, deleted, PageRequest.of(page, size));
        return new PageResult<>(result.getContent().stream().map(TaskEntity::toDomain).toList(), result.hasNext());
    }

    @Override public void purge(UUID tenantId, UUID projectId, UUID id) {
        repository.purge(tenantId, projectId, id);
        repository.flush();
    }

    @Override public void purgeAllOfProject(UUID tenantId, UUID projectId) {
        repository.purgeAllOfProject(tenantId, projectId);
        repository.flush();
    }
}
