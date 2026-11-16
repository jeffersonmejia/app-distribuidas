package com.erp.features.projects.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import com.erp.features.projects.domain.model.TaskStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

//SOLID: ISP — ESTE REPOSITORIO EXPONE SOLO CONSULTAS DE TAREAS DEL TENANT.
interface TaskJpaRepository extends JpaRepository<TaskEntity, UUID> {
    Optional<TaskEntity> findByTenantIdAndProjectIdAndId(UUID tenantId, UUID projectId, UUID id);

    @Query("""
            select t from TaskEntity t
            where t.tenantId = :tenant and t.projectId = :project
              and ((:deleted = true and t.deletedAt is not null) or (:deleted = false and t.deletedAt is null))
              and (:status is null or t.status = :status)
            order by t.createdAt, t.id
            """)
    Slice<TaskEntity> search(@Param("tenant") UUID tenant, @Param("project") UUID project,
                             @Param("status") TaskStatus status, @Param("deleted") boolean deleted,
                             Pageable pageable);

    @Modifying
    @Query("delete from TaskEntity t where t.tenantId = :tenant and t.projectId = :project and t.id = :id")
    int purge(@Param("tenant") UUID tenant, @Param("project") UUID project, @Param("id") UUID id);

    @Modifying
    @Query("delete from TaskEntity t where t.tenantId = :tenant and t.projectId = :project")
    int purgeAllOfProject(@Param("tenant") UUID tenant, @Param("project") UUID project);
}
