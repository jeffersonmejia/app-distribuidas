package com.erp.features.inventory.infrastructure.persistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import com.erp.features.inventory.domain.model.Product;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

//SOLID: SRP — ESTA ENTIDAD MAPE A UN PRODUCTO DE INVENTORY.
@Entity
@Table(name = "inventory_product")
class ProductEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(nullable = false, columnDefinition = "text") String name;
    @Column(nullable = false, columnDefinition = "text") String sku;
    @Column(nullable = false, columnDefinition = "text") String category;
    @Column(columnDefinition = "text") String description;
    @Column(nullable = false, columnDefinition = "text") String unit;
    @Column(name = "purchase_price", nullable = false, columnDefinition = "numeric") BigDecimal purchasePrice;
    @Column(name = "selling_price", nullable = false, columnDefinition = "numeric") BigDecimal sellingPrice;
    @Column(name = "min_stock", nullable = false, columnDefinition = "numeric") BigDecimal minStock;
    @Column(name = "created_at", nullable = false, updatable = false) Instant createdAt;
    @Column(name = "created_by", nullable = false, updatable = false) UUID createdBy;
    @Column(name = "updated_at", nullable = false) Instant updatedAt;
    @Column(name = "updated_by", nullable = false) UUID updatedBy;
    @Column(name = "deleted_at") Instant deletedAt;
    protected ProductEntity() {}

    //SOLID: SRP — CONVIERTE EL MODELO VALIDADO EN SU REPRESENTACIÓN PERSISTENTE.
    ProductEntity(Product product) { apply(product); }

    //SOLID: SRP — ACTUALIZA SOLO LOS CAMPOS MUTABLES DEL PRODUCTO.
    void apply(Product product) {
        id = product.id(); tenantId = product.tenantId(); name = product.name(); sku = product.sku();
        category = product.category(); description = product.description(); unit = product.unit();
        purchasePrice = product.purchasePrice(); sellingPrice = product.sellingPrice(); minStock = product.minStock();
        createdAt = product.createdAt(); createdBy = product.createdBy(); updatedAt = product.updatedAt(); updatedBy = product.updatedBy();
    }

    //SOLID: SRP — RECONSTRUYE EL MODELO DE DOMINIO DESDE EL REGISTRO PERSISTIDO.
    Product toDomain() {
        return new Product(id, tenantId, name, sku, category, description, unit, purchasePrice, sellingPrice,
                minStock, createdAt, createdBy, updatedAt, updatedBy);
    }
}
