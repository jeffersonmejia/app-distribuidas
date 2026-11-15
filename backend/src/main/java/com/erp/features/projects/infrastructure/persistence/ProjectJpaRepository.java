package com.erp.features.projects.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

//SOLID: ISP — ESTE REPOSITORIO EXPONE SOLO CONSULTAS DE PROYECTOS DEL TENANT.
interface ProjectJpaRepository extends JpaRepository<ProjectEntity, UUID> {
    Optional<ProjectEntity> findByTenantIdAndId(UUID tenantId, UUID id);

    @Query("""
            select p from ProjectEntity p
            where p.tenantId = :tenant
              and ((:deleted = true and p.deletedAt is not null) or (:deleted = false and p.deletedAt is null))
              and (:search is null or lower(p.name) like concat('%', :search, '%'))
            order by lower(p.name), p.id
            """)
    Slice<ProjectEntity> search(@Param("tenant") UUID tenant, @Param("deleted") boolean deleted,
                                @Param("search") String search, Pageable pageable);

    @Modifying
    @Query("delete from ProjectEntity p where p.tenantId = :tenant and p.id = :id")
    int purge(@Param("tenant") UUID tenant, @Param("id") UUID id);
}
