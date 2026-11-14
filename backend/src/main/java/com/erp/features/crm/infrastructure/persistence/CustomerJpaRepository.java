package com.erp.features.crm.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.erp.features.crm.domain.model.CustomerStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

//SOLID: ISP — ESTE REPOSITORIO EXPONE SOLO CONSULTAS DE CLIENTES DEL TENANT.
interface CustomerJpaRepository extends JpaRepository<CustomerEntity, UUID> {
    Optional<CustomerEntity> findByTenantIdAndId(UUID tenantId, UUID id);
    boolean existsByTenantIdAndCedulaAndIdNot(UUID tenantId, String cedula, UUID id);
    boolean existsByTenantIdAndEmailAndIdNot(UUID tenantId, String email, UUID id);
    List<CustomerEntity> findByTenantIdAndIdInAndStatusAndDeletedAtIsNull(
            UUID tenantId, List<UUID> ids, CustomerStatus status);

    @Query("""
            select c from CustomerEntity c
            where c.tenantId = :tenant and c.deletedAt is null
              and (:status is null or c.status = :status)
              and (:search is null or lower(c.fullName) like concat('%', :search, '%')
                   or c.cedula like concat('%', :search, '%')
                   or c.email like concat('%', :search, '%'))
            order by c.fullName, c.id
            """)
    Slice<CustomerEntity> search(@Param("tenant") UUID tenant, @Param("status") CustomerStatus status,
                                 @Param("search") String search, Pageable pageable);
}
