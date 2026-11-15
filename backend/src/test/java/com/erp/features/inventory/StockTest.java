package com.erp.features.inventory;

import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import com.erp.features.inventory.domain.model.Stock;
import com.erp.features.inventory.domain.model.InventoryException;
import org.junit.jupiter.api.Test;

//SOLID: SRP — ESTA SUITE COMPRUEBA LAS INVARIANTES DEL MODELO SIN FRAMEWORKS.
class StockTest {
    private static final UUID ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-11-15T00:00:00Z");
    private static Stock stock() { return new Stock(ID, ID, ID, "u", BigDecimal.TEN, BigDecimal.ZERO, NOW, ID, NOW, ID); }

    @Test void exactDecimalArithmeticAndAudit() {
        UUID actor = UUID.randomUUID();
        Stock updated = stock().receive(new BigDecimal("0.1"), actor, NOW.plusSeconds(1))
                .receive(new BigDecimal("0.2"), actor, NOW.plusSeconds(1));
        assertEquals(0, new BigDecimal("10.3").compareTo(updated.onHand()));
        assertEquals(actor, updated.updatedBy()); assertEquals(ID, updated.createdBy());
    }

    @Test void reservedAndPhysicalBalancesStayConsistent() {
        Stock reserved = stock().reserve(BigDecimal.ONE, ID, NOW);
        Stock confirmed = reserved.confirm(BigDecimal.ONE, ID, NOW);
        assertEquals(0, new BigDecimal("9").compareTo(confirmed.onHand()));
        assertEquals(0, confirmed.reserved().signum());
        assertEquals(BigDecimal.TEN, reserved.release(BigDecimal.ONE, ID, NOW).available());
        assertThrows(InventoryException.class, () -> reserved.confirm(BigDecimal.TEN, ID, NOW));
        assertThrows(InventoryException.class, () -> reserved.release(BigDecimal.TEN, ID, NOW));
    }

    @Test void refusesInvalidQuantitiesAndInvalidRestoredBalances() {
        for (BigDecimal invalid : new BigDecimal[] {null, BigDecimal.ZERO, BigDecimal.ONE.negate()}) {
            assertThrows(InventoryException.class, () -> stock().receive(invalid, ID, NOW));
            assertThrows(InventoryException.class, () -> stock().issue(invalid, ID, NOW));
            assertThrows(InventoryException.class, () -> stock().reserve(invalid, ID, NOW));
            assertThrows(InventoryException.class, () -> stock().confirm(invalid, ID, NOW));
            assertThrows(InventoryException.class, () -> stock().release(invalid, ID, NOW));
        }
        assertThrows(InventoryException.class, () -> stock().issue(new BigDecimal("11"), ID, NOW));
        assertThrows(InventoryException.class, () -> new Stock(ID, ID, ID, "", BigDecimal.ZERO, BigDecimal.ZERO, NOW, ID, NOW, ID));
        assertThrows(InventoryException.class, () -> new Stock(ID, ID, ID, "u", BigDecimal.ZERO, BigDecimal.ONE, NOW, ID, NOW, ID));
        assertThrows(InventoryException.class, () -> new Stock(ID, ID, ID, "u", BigDecimal.ONE.negate(), BigDecimal.ZERO, NOW, ID, NOW, ID));
        assertThrows(InventoryException.class, () -> new Stock(ID, ID, ID, "u", BigDecimal.ONE, BigDecimal.ONE.negate(), NOW, ID, NOW, ID));
        assertThrows(InventoryException.class, () -> stock().receive(BigDecimal.ONE, null, NOW));
    }
}

