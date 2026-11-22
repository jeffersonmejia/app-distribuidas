package com.erp.features.pos;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import com.erp.features.inventory.api.InventoryMovements;
import com.erp.features.inventory.api.InventoryFailure;
import com.erp.features.accounting.api.AccountingEntries;
import com.erp.features.pos.api.SaleException;
import com.erp.features.pos.api.Sales;
import com.erp.features.pos.application.SaleService;
import com.erp.features.pos.application.SaleStore;
import com.erp.features.tenancy.api.TenantId;
import com.erp.features.tenancy.api.TenantAccess;
import org.junit.jupiter.api.Test;

//SOLID: SRP — ESTA SUITE VERIFICA VALIDACIÓN E IDEMPOTENCIA DE VENTAS.
class SaleServiceTest {
    private final InventoryMovements inventory = mock(InventoryMovements.class);
    private final SaleStore store = mock(SaleStore.class);
    private final AccountingEntries accounting = mock(AccountingEntries.class);
    private final TenantAccess access = mock(TenantAccess.class);
    private final SaleService service = new SaleService(inventory, store, accounting, access);
    private final TenantId tenant = new TenantId(UUID.randomUUID());
    private final UUID actor = UUID.randomUUID();
    private final UUID product = UUID.randomUUID();

    @Test void persistsInCallbackAndReturnsOriginalOnRetry() {
        when(inventory.issueAndExecute(any(), any(), any())).thenAnswer(invocation -> {
            Function<InventoryMovements.Operation, ?> callback = invocation.getArgument(2);
            return callback.apply(new InventoryMovements.Operation(UUID.randomUUID(), tenant.value(), actor,
                    InventoryMovements.Type.ISSUE, "sale", null, List.of(), Instant.now()));
        });
        Sales.Command command = command(UUID.randomUUID(), "2.345", "4.10", "0.25");
        Sales.Sale sale = service.register(tenant, command);
        assertEquals(new BigDecimal("9.61"), sale.lines().get(0).netAmount());
        var saved = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(store).save(eq(tenant.value()), eq(actor), saved.capture(), eq(sale));
        when(store.find(tenant.value(), command.saleId())).thenReturn(
                Optional.of(new SaleStore.StoredSale(saved.getValue(), sale)));
        assertEquals(sale, service.register(tenant, command));
        assertEquals(SaleException.Code.IDEMPOTENCY_CONFLICT, assertThrows(SaleException.class,
                () -> service.register(tenant, command(command.saleId(), "2.345", "5.00", "0.25"))).code());
        verify(store, times(1)).save(any(), any(), any(), any());
    }

    @Test void invalidInputDoesNotCallInventory() {
        UUID id = UUID.randomUUID();
        assertThrows(SaleException.class, () -> service.register(tenant, command(id, "0", "4.00", "0.00")));
        assertThrows(SaleException.class, () -> service.register(tenant, command(id, "1", "4.001", "0.00")));
        assertThrows(SaleException.class, () -> service.register(tenant, command(id, "1", "-1.00", "0.00")));
        assertThrows(SaleException.class, () -> service.register(tenant, command(id, "1", "1.00", "-0.01")));
        assertThrows(SaleException.class, () -> service.register(tenant, new Sales.Command(id, List.of())));
        verifyNoInteractions(inventory);
    }
    @Test void convertsOnlyKnownInventoryFailuresToSafePosCodes() {
        Sales.Command command = command(UUID.randomUUID(), "1", "1.00", "0.00");
        for (SaleException.Code code : SaleException.Code.values()) {
            reset(inventory);
            when(inventory.issueAndExecute(any(), any(), any())).thenThrow(new TestInventoryFailure(code.name()));
            SaleException result = assertThrows(SaleException.class, () -> service.register(tenant, command));
            assertEquals(code.name(), result.code().name());
            assertEquals(code.name(), result.getMessage());
            assertNull(result.getCause());
        }
        reset(inventory);
        when(inventory.issueAndExecute(any(), any(), any())).thenThrow(new TestInventoryFailure("NEW_INTERNAL_CODE"));
        SaleException unknown = assertThrows(SaleException.class, () -> service.register(tenant, command));
        assertEquals(SaleException.Code.INVENTORY_ERROR, unknown.code());
        assertEquals("INVENTORY_ERROR", unknown.getMessage());
        assertNull(unknown.getCause());
        reset(inventory);
        var unexpected = new IllegalStateException("internal detail");
        when(inventory.issueAndExecute(any(), any(), any())).thenThrow(unexpected);
        assertSame(unexpected, assertThrows(IllegalStateException.class, () -> service.register(tenant, command)));
        verifyNoInteractions(store);
    }
    private static final class TestInventoryFailure extends RuntimeException implements InventoryFailure {
        private final String code;
        private TestInventoryFailure(String code) { super("private detail"); this.code = code; }
        @Override public String inventoryCode() { return code; }
    }
    private Sales.Command command(UUID id, String quantity, String price, String tax) {
        return new Sales.Command(id, List.of(new Sales.Line(product, "unit", new BigDecimal(quantity),
                new BigDecimal(price), new BigDecimal(tax))));
    }
}
