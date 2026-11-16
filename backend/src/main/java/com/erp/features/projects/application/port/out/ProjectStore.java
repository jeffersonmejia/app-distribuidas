package com.erp.features.projects.application.port.out;

import java.util.Optional;
import java.util.UUID;
import com.erp.features.projects.domain.model.Project;

//SOLID: DIP — ESTE PUERTO SEPARA LOS CASOS DE USO DE LA PERSISTENCIA DE PROYECTOS.
public interface ProjectStore {
    /** Busca incluyendo proyectos con borrado lógico. */
    Optional<Project> find(UUID tenantId, UUID id);

    Project save(Project project);

    PageResult<Project> search(UUID tenantId, String nameTerm, boolean deleted, int page, int size);

    /** Elimina físicamente el proyecto; sus tareas deben haberse purgado antes. */
    void purge(UUID tenantId, UUID id);
}
