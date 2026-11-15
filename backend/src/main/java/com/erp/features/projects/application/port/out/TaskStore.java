package com.erp.features.projects.application.port.out;

import java.util.Optional;
import java.util.UUID;
import com.erp.features.projects.domain.model.Task;
import com.erp.features.projects.domain.model.TaskStatus;

//SOLID: DIP — ESTE PUERTO SEPARA LOS CASOS DE USO DE LA PERSISTENCIA DE TAREAS.
public interface TaskStore {
    /** Busca incluyendo tareas con borrado lógico. */
    Optional<Task> find(UUID tenantId, UUID projectId, UUID id);

    Task save(Task task);

    PageResult<Task> search(UUID tenantId, UUID projectId, TaskStatus status, boolean deleted, int page, int size);

    void purge(UUID tenantId, UUID projectId, UUID id);

    void purgeAllOfProject(UUID tenantId, UUID projectId);
}
