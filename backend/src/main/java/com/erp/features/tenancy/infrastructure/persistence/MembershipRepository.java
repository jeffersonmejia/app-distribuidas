package com.erp.features.tenancy.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

//SOLID: SRP — ESTE REPOSITORIO CONSULTA MEMBRESÍAS PROPIAS DEL MÓDULO TENANCY.
public interface MembershipRepository extends JpaRepository<MembershipEntity, UUID> {
    Optional<MembershipEntity> findByTenantIdAndActorId(UUID tenantId, UUID actorId);
}
