package com.erp.features.inventory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import com.erp.features.inventory.application.port.out.InventoryStore;
import com.erp.features.inventory.application.port.out.ProductStore;
import com.erp.features.inventory.application.usecase.InventoryService;
import com.erp.features.inventory.application.usecase.ProductCatalogService;
import com.erp.features.inventory.domain.model.Product;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantContext;
import com.erp.features.tenancy.api.TenantId;
import com.erp.features.identity.api.ActorId;
import org.junit.jupiter.api.Test;

//SOLID: SRP — ESTA SUITE VERIFICA EL ALTA ATÓMICA DEL CATÁLOGO Y SU STOCK INICIAL.
class ProductCatalogServiceTest {
    private final UUID tenantId = UUID.randomUUID();
    private final UUID actorId = UUID.randomUUID();
    private final TenantId tenant = new TenantId(tenantId);
    private final TenantAccess access = mock(TenantAccess.class);
    private final ProductStore products = mock(ProductStore.class);
    private final InventoryStore stock = mock(InventoryStore.class);
    private final InventoryService inventory = mock(InventoryService.class);
    private final ProductCatalogService service = new ProductCatalogService(access, products, stock, inventory);

    //SOLID: SRP — ASEGURA QUE EL STOCK INICIAL USA RECEPCIÓN EN LA OPERACIÓN AUTORIZADA.
    @Test void createsProductAndReceivesInitialStockAtomically() {
        when(access.execute(eq(tenant), eq("inventory:catalog:manage"), any())).thenAnswer(invocation -> {
            var operation = invocation.<com.erp.features.tenancy.api.TenantOperation<Object>>getArgument(2);
            return operation.apply(new TenantContext(tenant, new ActorId(actorId)));
        });
        when(products.skuExists(tenantId, "SKU-1", null)).thenReturn(false);
        when(products.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(stock.findStock(eq(tenantId), any())).thenReturn(Optional.empty());
        var result = service.create(tenant, new ProductCatalogService.ProductInput("Producto", "SKU-1", "Materiales",
                null, "unidad", "2.50", "3.00", "1", "4"));

        assertEquals("SKU-1", result.sku());
        verify(products).save(argThat(product -> product.purchasePrice().equals(new BigDecimal("2.50"))));
        verify(inventory).receiveJoined(eq(tenant), argThat(command -> command.lines().getFirst().quantity().equals(new BigDecimal("4"))));
    }
}
