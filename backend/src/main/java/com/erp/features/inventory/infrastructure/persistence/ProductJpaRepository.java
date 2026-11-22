package com.erp.features.inventory.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;

//SOLID: SRP — ESTE REPOSITORIO EJECUTA CONSULTAS TENANT-SCOPED DEL CATÁLOGO.
interface ProductJpaRepository extends JpaRepository<ProductEntity, UUID> {
    //SOLID: SRP — CONSULTA PRODUCTOS CON FILTROS Y ORDEN ESTABLE EN POSTGRESQL.
    @Query("select p from ProductEntity p where p.tenantId = :tenant and p.deletedAt is null "
            + "and (:category is null or p.category = :category) "
            + "and (:search is null or lower(p.name) like lower(concat('%', :search, '%')) "
            + "or lower(p.sku) like lower(concat('%', :search, '%'))) order by p.name, p.id")
    Slice<ProductEntity> search(@Param("tenant") UUID tenant, @Param("search") String search,
                                @Param("category") String category, Pageable pageable);

    //SOLID: SRP — VERIFICA SKU ÚNICO DENTRO DEL TENANT Y EXCLUYE EL PRODUCTO EDITADO.
    @Query("select count(p) > 0 from ProductEntity p where p.tenantId = :tenant and p.deletedAt is null "
            + "and p.sku = :sku and (:exceptId is null or p.id <> :exceptId)")
    boolean skuExists(@Param("tenant") UUID tenant, @Param("sku") String sku, @Param("exceptId") UUID exceptId);

    //SOLID: SRP — BUSCA UN PRODUCTO ACTIVO POR SU ID Y TENANT.
    @Query("select p from ProductEntity p where p.tenantId = :tenant and p.id = :id and p.deletedAt is null")
    List<ProductEntity> findActive(@Param("tenant") UUID tenant, @Param("id") UUID id);
}
