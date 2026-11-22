package com.erp.features.inventory.application.port.out;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.math.BigDecimal;
import com.erp.features.inventory.domain.model.Product;

//SOLID: DIP — ESTE PUERTO SEPARA EL CATÁLOGO DE SU PERSISTENCIA.
public interface ProductStore {
    //SOLID: SRP — REPRESENTA UNA PÁGINA Y SI HAY RESULTADOS SIGUIENTES.
    record Slice(List<Product> items, boolean hasNext) {}
    //SOLID: SRP — AGREGA MÉTRICAS DESDE CATÁLOGO Y EXISTENCIAS PERSISTIDOS.
    record Metrics(long totalProducts, long lowStockCount, BigDecimal inventoryValue, java.util.Map<String, Long> categories) {}
    Optional<Product> find(UUID tenantId, UUID productId);
    boolean skuExists(UUID tenantId, String sku, UUID exceptProductId);
    Slice search(UUID tenantId, String search, String category, int page, int size);
    Product save(Product product);
    Metrics metrics(UUID tenantId);
}
