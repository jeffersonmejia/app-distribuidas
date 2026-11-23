package com.erp.features.inventory.application.usecase;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import com.erp.features.inventory.api.InventoryMovements;
import com.erp.features.inventory.application.port.out.InventoryStore;
import com.erp.features.inventory.application.port.out.ProductStore;
import com.erp.features.inventory.domain.model.InventoryException;
import com.erp.features.inventory.domain.model.Product;
import com.erp.features.inventory.domain.model.Stock;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantId;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import static com.erp.features.inventory.domain.model.InventoryException.Code.*;

//SOLID: SRP — ESTE SERVICIO COORDINA EL CATÁLOGO Y EL INVENTARIO AUTORIZADOS.
@Service
public class ProductCatalogService {
    private final TenantAccess access;
    private final ProductStore products;
    private final InventoryStore stock;
    private final InventoryService inventory;

    //SOLID: DIP — RECIBE PUERTOS Y CASOS DE USO, NO IMPLEMENTACIONES WEB O JPA.
    public ProductCatalogService(TenantAccess access, ProductStore products, InventoryStore stock,
                                 InventoryService inventory) {
        this.access = access; this.products = products; this.stock = stock; this.inventory = inventory;
    }

    //SOLID: SRP — DEVUELVE PRODUCTOS Y EXISTENCIAS PAGINADOS PARA EL TENANT AUTORIZADO.
    public ProductPage list(TenantId tenant, String search, String category, int page, int size) {
        validatePage(page, size);
        return access.execute(tenant, "inventory:catalog:read", context -> {
            var slice = products.search(context.tenantId().value(), search, category, page, size);
            return new ProductPage(slice.items().stream().map(this::view).toList(), page, size, slice.hasNext());
        });
    }

    //SOLID: SRP — DEVUELVE EL PRODUCTO SI PERTENECE AL TENANT VALIDADO.
    public ProductView get(TenantId tenant, UUID id) {
        return access.execute(tenant, "inventory:catalog:read", context -> view(requiredProduct(context.tenantId().value(), id)));
    }

    //SOLID: SRP — CREA PRODUCTO Y EXISTENCIA INICIAL COMO UNA OPERACIÓN ATÓMICA.
    public ProductView create(TenantId tenant, ProductInput input) {
        validateInput(input, true);
        return access.execute(tenant, "inventory:catalog:manage", context -> {
            UUID tenantId = context.tenantId().value();
            String sku = input.sku().trim();
            if (products.skuExists(tenantId, sku, null)) { throw new InventoryException(SKU_ALREADY_EXISTS); }
            Instant now = now();
            UUID id = UUID.randomUUID();
            Product product = product(id, tenantId, input, context.actorId().value(), now, now, context.actorId().value());
            try { product = products.save(product); }
            catch (DataIntegrityViolationException conflict) { throw new InventoryException(SKU_ALREADY_EXISTS); }
            BigDecimal initialStock = quantity(input.initialStock());
            if (initialStock.signum() > 0) {
                String reference = "inventory:product-initial:" + id;
                inventory.receiveJoined(tenant, new InventoryMovements.StockCommand(reference, reference,
                        List.of(new InventoryMovements.Line(id, product.unit(), initialStock))));
            } else {
                stock.saveStock(new Stock(UUID.randomUUID(), tenantId, id, product.unit(), BigDecimal.ZERO,
                        BigDecimal.ZERO, now, context.actorId().value(), now, context.actorId().value()));
            }
            return view(product);
        });
    }

    //SOLID: SRP — ACTUALIZA DATOS DEL CATÁLOGO Y CONSERVA LA UNIDAD YA ASOCIADA AL STOCK.
    public ProductView update(TenantId tenant, UUID id, ProductInput input) {
        validateInput(input, false);
        return access.execute(tenant, "inventory:catalog:manage", context -> {
            UUID tenantId = context.tenantId().value();
            Product previous = requiredProduct(tenantId, id);
            if (!previous.unit().equals(input.unit().trim())) { throw new InventoryException(INVALID_REQUEST); }
            String sku = input.sku().trim();
            if (products.skuExists(tenantId, sku, id)) { throw new InventoryException(SKU_ALREADY_EXISTS); }
            Product updated;
            try {
                updated = previous.update(input.name().trim(), sku, input.category(), input.description(), previous.unit(),
                        money(input.purchasePrice()), money(input.sellingPrice()), quantity(input.minStock()),
                        context.actorId().value(), now());
                updated = products.save(updated);
            } catch (DataIntegrityViolationException conflict) { throw new InventoryException(SKU_ALREADY_EXISTS); }
            return view(updated);
        });
    }

    //SOLID: SRP — CALCULA MÉTRICAS DEL CATÁLOGO PARA EL TENANT AUTORIZADO.
    public ProductMetrics metrics(TenantId tenant) {
        return access.execute(tenant, "inventory:catalog:read", context -> {
            var result = products.metrics(context.tenantId().value());
            var categories = new java.util.HashMap<String, Long>();
            for (String category : List.of("Materiales", "Equipos", "Herramientas", "Repuestos", "Servicios")) {
                categories.put(category, result.categories().getOrDefault(category, 0L));
            }
            return new ProductMetrics(result.totalProducts(), result.lowStockCount(), result.inventoryValue().toPlainString(), java.util.Map.copyOf(categories));
        });
    }

    //SOLID: SRP — EXPONE DISPONIBILIDAD SIN CONSULTAR EXISTENCIAS DE OTRO TENANT.
    public InventoryMovements.Availability availability(TenantId tenant, UUID id) {
        return access.execute(tenant, "inventory:stock:read", context -> {
            Product product = requiredProduct(context.tenantId().value(), id);
            Stock current = stock.findStock(context.tenantId().value(), id).orElse(null);
            BigDecimal onHand = current == null ? BigDecimal.ZERO : current.onHand();
            BigDecimal reserved = current == null ? BigDecimal.ZERO : current.reserved();
            return new InventoryMovements.Availability(id, product.unit(), onHand, reserved, onHand.subtract(reserved));
        });
    }

    //SOLID: SRP — MAPEA EL PRODUCTO CON SU SALDO Y ESTADO DERIVADO.
    private ProductView view(Product product) {
        Stock current = stock.findStock(product.tenantId(), product.id()).orElse(null);
        BigDecimal onHand = current == null ? BigDecimal.ZERO : current.onHand();
        BigDecimal reserved = current == null ? BigDecimal.ZERO : current.reserved();
        return new ProductView(product.id(), product.name(), product.sku(), product.category(), product.description(),
                product.unit(), product.purchasePrice().toPlainString(), product.sellingPrice().toPlainString(),
                onHand.toPlainString(), product.minStock().toPlainString(),
                onHand.compareTo(product.minStock()) <= 0 ? "low" : "available", product.createdAt(), product.updatedAt());
    }

    //SOLID: SRP — BUSCA UN PRODUCTO ACTIVO Y DEVUELVE UN ERROR ESTABLE SI NO EXISTE.
    private Product requiredProduct(UUID tenant, UUID id) {
        if (id == null) { throw new InventoryException(INVALID_REQUEST); }
        return products.find(tenant, id).orElseThrow(() -> new InventoryException(PRODUCT_NOT_FOUND));
    }

    //SOLID: SRP — CONSTRUYE EL MODELO DE DOMINIO DESDE EL DTO VALIDADO.
    private Product product(UUID id, UUID tenant, ProductInput input, UUID createdBy, Instant createdAt,
                            Instant updatedAt, UUID updatedBy) {
        return new Product(id, tenant, input.name().trim(), input.sku().trim(), input.category(), input.description(),
                input.unit().trim(), money(input.purchasePrice()), money(input.sellingPrice()), quantity(input.minStock()),
                createdAt, createdBy, updatedAt, updatedBy);
    }

    //SOLID: SRP — VALIDA LAS ENTRADAS WEB SIN CONFIAR EN VALIDACIONES DEL CLIENTE.
    private static void validateInput(ProductInput input, boolean create) {
        if (input == null || blank(input.name()) || blank(input.sku()) || blank(input.category()) || blank(input.unit())
                || input.purchasePrice() == null || input.sellingPrice() == null || input.minStock() == null
                || (create && input.initialStock() == null) || (!create && input.initialStock() != null)) {
            throw new InventoryException(INVALID_REQUEST);
        }
        money(input.purchasePrice()); money(input.sellingPrice()); quantity(input.minStock());
        if (create) { quantity(input.initialStock()); }
    }

    //SOLID: SRP — PARSEA DINERO CON DOS DECIMALES EXACTOS, SIN REDONDEO IMPLÍCITO.
    private static BigDecimal money(String value) {
        try {
            BigDecimal amount = new BigDecimal(value).setScale(2, RoundingMode.UNNECESSARY);
            if (amount.signum() < 0) { throw new NumberFormatException(); }
            return amount;
        } catch (NumberFormatException | ArithmeticException failure) { throw new InventoryException(INVALID_REQUEST); }
    }

    //SOLID: SRP — PARSEA UNA CANTIDAD NO NEGATIVA.
    private static BigDecimal quantity(String value) {
        try {
            BigDecimal amount = new BigDecimal(value);
            if (amount.signum() < 0 || amount.precision() > 1000 || Math.abs((long) amount.scale()) > 1000) {
                throw new NumberFormatException();
            }
            return amount;
        } catch (NumberFormatException | NullPointerException failure) { throw new InventoryException(INVALID_REQUEST); }
    }

    //SOLID: SRP — VALIDA EL TAMAÑO MÁXIMO Y EL ÍNDICE DE PÁGINA.
    private static void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > 5) { throw new InventoryException(INVALID_REQUEST); }
    }

    //SOLID: SRP — VALIDA TEXTO REQUERIDO.
    private static boolean blank(String value) { return value == null || value.isBlank(); }

    //SOLID: SRP — GENERA INSTANTES DE AUDITORÍA UTC CON PRECISIÓN DE BASE DE DATOS.
    private static Instant now() { return Instant.now().truncatedTo(ChronoUnit.MICROS); }

    //SOLID: SRP — TRANSPORTA UNA SOLICITUD DE PRODUCTO CON IMPORTES DECIMALES EN CADENA.
    public record ProductInput(String name, String sku, String category, String description, String unit,
                               String purchasePrice, String sellingPrice, String minStock, String initialStock) {}
    //SOLID: SRP — TRANSPORTA EL PRODUCTO Y SUS EXISTENCIAS PARA LA API REST.
    public record ProductView(UUID id, String name, String sku, String category, String description, String unit,
                              String purchasePrice, String sellingPrice, String stock, String minStock,
                              String status, Instant createdAt, Instant updatedAt) {}
    //SOLID: SRP — TRANSPORTA UNA PÁGINA DE PRODUCTOS.
    public record ProductPage(List<ProductView> items, int page, int size, boolean hasNext) {}
    //SOLID: SRP — TRANSPORTA AGREGADOS CALCULADOS DESDE LA PERSISTENCIA.
    public record ProductMetrics(long totalProducts, long lowStockCount, String totalInventoryValue,
                                 java.util.Map<String, Long> categoryCounts) {}
}
