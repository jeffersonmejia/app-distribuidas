package com.erp.features.inventory.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import com.erp.features.inventory.application.port.out.ProductStore;
import com.erp.features.inventory.domain.model.Product;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

//SOLID: SRP — ESTE ADAPTADOR IMPLEMENTA EL PUERTO DE CATÁLOGO CON JPA.
@Repository
class JpaProductStore implements ProductStore {
    private final ProductJpaRepository products;
    private final JdbcTemplate jdbc;
    JpaProductStore(ProductJpaRepository products, JdbcTemplate jdbc) { this.products = products; this.jdbc = jdbc; }

    //SOLID: SRP — OBTIENE UN PRODUCTO SIN SALIR DEL TENANT VALIDADO.
    @Override public Optional<Product> find(UUID tenantId, UUID productId) {
        return products.findActive(tenantId, productId).stream().findFirst().map(ProductEntity::toDomain);
    }

    //SOLID: SRP — COMPRUEBA LA UNICIDAD ACTIVA DEL SKU EN EL TENANT.
    @Override public boolean skuExists(UUID tenantId, String sku, UUID exceptProductId) {
        return products.skuExists(tenantId, sku, exceptProductId);
    }

    //SOLID: SRP — EJECUTA LA BÚSQUEDA PAGINADA LIMITADA A CINCO PRODUCTOS.
    @Override public Slice search(UUID tenantId, String search, String category, int page, int size) {
        var result = products.search(tenantId, blankToNull(search), blankToNull(category), PageRequest.of(page, size));
        return new Slice(result.getContent().stream().map(ProductEntity::toDomain).toList(), result.hasNext());
    }

    //SOLID: SRP — PERSISTE EL PRODUCTO VALIDADO.
    @Override public Product save(Product product) {
        ProductEntity entity = products.findActive(product.tenantId(), product.id()).stream().findFirst().orElse(null);
        if (entity == null) { entity = new ProductEntity(product); }
        else { entity.apply(product); }
        return products.saveAndFlush(entity).toDomain();
    }

    //SOLID: SRP — AGREGA MÉTRICAS TENANT-SCOPED EN POSTGRESQL, SIN PAGINAR EN MEMORIA.
    @Override public Metrics metrics(UUID tenantId) {
        Map<String, Long> categories = new HashMap<>();
        var rows = jdbc.query("select p.category, count(p.id), "
                        + "count(*) filter (where coalesce(s.on_hand, 0) <= p.min_stock), "
                        + "coalesce(sum(p.purchase_price * coalesce(s.on_hand, 0)), 0) "
                        + "from inventory_product p left join inventory_stock s "
                        + "on s.tenant_id = p.tenant_id and s.product_id = p.id "
                        + "where p.tenant_id = ? and p.deleted_at is null group by p.category",
                (result, rowNumber) -> new Object[]{result.getString(1), result.getLong(2), result.getLong(3), result.getBigDecimal(4)},
                tenantId);
        long total = 0;
        long low = 0;
        BigDecimal value = BigDecimal.ZERO.setScale(2);
        for (Object[] row : rows) {
            categories.put((String) row[0], (Long) row[1]);
            total += (Long) row[1]; low += (Long) row[2]; value = value.add((BigDecimal) row[3]);
        }
        return new Metrics(total, low, value, Map.copyOf(categories));
    }

    //SOLID: SRP — NORMALIZA LOS FILTROS VACÍOS PARA LA CONSULTA.
    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
