package com.erp.features.tenancy.infrastructure.persistence;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

//SOLID: SRP — ESTE REPOSITORIO CONSULTA EL ESTADO ADMINISTRATIVO DEL TENANT.
public interface TenantRepository extends JpaRepository<TenantEntity, UUID> { }
