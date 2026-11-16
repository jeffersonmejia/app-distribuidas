package com.erp.features.accounting.domain.model;

import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

//SOLID: SRP — ESTA SUITE VERIFICA EL CÁLCULO Y LA PRESENTACIÓN DE IMPORTES.
class SaleJournalTest {
    @Test void saleDebitsTotalAndCreditsNetAndEachTax() {
        SaleJournal journal = SaleJournal.forSale(List.of(
                new SaleJournal.SaleLine(new BigDecimal("1000.00"), new BigDecimal("150.00")),
                new SaleJournal.SaleLine(new BigDecimal("73.44"), new BigDecimal("11.16"))));
        assertEquals(new SaleJournal.Entry(SaleJournal.Account.CASH_BANK, SaleJournal.Side.DEBIT,
                new BigDecimal("1234.60")), journal.entries().get(0));
        assertEquals(new SaleJournal.Entry(SaleJournal.Account.SALES, SaleJournal.Side.CREDIT,
                new BigDecimal("1073.44")), journal.entries().get(1));
        assertEquals(new BigDecimal("150.00"), journal.entries().get(2).amount());
        assertEquals(new BigDecimal("11.16"), journal.entries().get(3).amount());
        assertEquals("1,234.60", UsdFormatter.format(journal.entries().get(0).amount()));
    }
    @Test void rejectsInvalidAmountsAndEmptySales() {
        assertThrows(IllegalArgumentException.class, () -> SaleJournal.forSale(List.of()));
        assertThrows(IllegalArgumentException.class,
                () -> new SaleJournal.SaleLine(new BigDecimal("0.001"), BigDecimal.ZERO));
        assertThrows(IllegalArgumentException.class,
                () -> new SaleJournal.SaleLine(BigDecimal.ONE, new BigDecimal("-0.01")));
        assertThrows(IllegalArgumentException.class,
                () -> new SaleJournal(List.of(new SaleJournal.Entry(SaleJournal.Account.CASH_BANK,
                        SaleJournal.Side.DEBIT, BigDecimal.ONE))));
        assertThrows(IllegalArgumentException.class,
                () -> SaleJournal.forPayment(new BigDecimal("1.00"), List.of(new BigDecimal("1.01"))));
    }
    @Test void paymentSubtractsTaxesWithoutApplyingRatesAndReversesEveryLine() {
        SaleJournal journal = SaleJournal.forPayment(new BigDecimal("12.50"),
                List.of(new BigDecimal("1.00"), new BigDecimal("0.50")));
        assertEquals(new BigDecimal("11.00"), journal.entries().get(1).amount());
        assertEquals(new BigDecimal("1.00"), journal.entries().get(2).amount());
        assertEquals(new BigDecimal("0.50"), journal.entries().get(3).amount());
        SaleJournal reverse = journal.reversed();
        for (int i = 0; i < journal.entries().size(); i++) {
            assertEquals(journal.entries().get(i).amount(), reverse.entries().get(i).amount());
            assertNotEquals(journal.entries().get(i).side(), reverse.entries().get(i).side());
        }
    }
}
