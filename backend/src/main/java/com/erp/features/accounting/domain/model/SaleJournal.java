package com.erp.features.accounting.domain.model;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

//SOLID: SRP — ESTE MODELO CALCULA EL ASIENTO DE UNA VENTA A PARTIR DE IMPORTES RECIBIDOS.
public record SaleJournal(List<Entry> entries) {
    public enum Account { CASH_BANK, SALES, TAX_PAYABLE }
    public enum Side { DEBIT, CREDIT }

    //SOLID: SRP — ESTE TIPO CONTIENE EL NETO Y EL IMPUESTO DE UNA LÍNEA.
    public record SaleLine(BigDecimal netAmount, BigDecimal taxAmount) {
        public SaleLine {
            netAmount = amount(netAmount);
            taxAmount = amount(taxAmount);
        }
    }

    //SOLID: SRP — ESTE TIPO REPRESENTA UN MOVIMIENTO DEL ASIENTO.
    public record Entry(Account account, Side side, BigDecimal amount) {
        public Entry {
            if (account == null || side == null) { throw new IllegalArgumentException("account and side required"); }
            amount = SaleJournal.amount(amount);
        }
    }

    public SaleJournal {
        entries = List.copyOf(entries);
        BigDecimal debits = BigDecimal.ZERO;
        BigDecimal credits = BigDecimal.ZERO;
        for (Entry entry : entries) {
            if (entry.side() == Side.DEBIT) { debits = debits.add(entry.amount()); }
            else { credits = credits.add(entry.amount()); }
        }
        if (entries.isEmpty() || debits.compareTo(credits) != 0) {
            throw new IllegalArgumentException("journal must be balanced");
        }
    }

    public static SaleJournal forSale(List<SaleLine> lines) {
        if (lines == null || lines.isEmpty() || lines.stream().anyMatch(java.util.Objects::isNull)) {
            throw new IllegalArgumentException("sale lines required");
        }
        BigDecimal net = BigDecimal.ZERO.setScale(2);
        BigDecimal tax = BigDecimal.ZERO.setScale(2);
        for (SaleLine line : lines) {
            net = net.add(line.netAmount());
            tax = tax.add(line.taxAmount());
        }
        List<Entry> entries = new ArrayList<>();
        entries.add(new Entry(Account.CASH_BANK, Side.DEBIT, net.add(tax)));
        entries.add(new Entry(Account.SALES, Side.CREDIT, net));
        for (SaleLine line : lines) {
            entries.add(new Entry(Account.TAX_PAYABLE, Side.CREDIT, line.taxAmount()));
        }
        return new SaleJournal(entries);
    }

    public static SaleJournal forPayment(BigDecimal total, List<BigDecimal> taxes) {
        BigDecimal payment = amount(total);
        if (taxes == null || taxes.isEmpty()) { throw new IllegalArgumentException("line taxes required"); }
        BigDecimal tax = BigDecimal.ZERO.setScale(2);
        List<BigDecimal> normalized = new ArrayList<>();
        for (BigDecimal value : taxes) {
            BigDecimal item = amount(value);
            tax = tax.add(item);
            normalized.add(item);
        }
        BigDecimal net = payment.subtract(tax);
        if (net.signum() < 0) { throw new IllegalArgumentException("tax exceeds payment"); }
        List<Entry> entries = new ArrayList<>();
        entries.add(new Entry(Account.CASH_BANK, Side.DEBIT, payment));
        entries.add(new Entry(Account.SALES, Side.CREDIT, net));
        for (BigDecimal value : normalized) { entries.add(new Entry(Account.TAX_PAYABLE, Side.CREDIT, value)); }
        return new SaleJournal(entries);
    }

    public SaleJournal reversed() {
        return new SaleJournal(entries.stream().map(entry -> new Entry(entry.account(),
                entry.side() == Side.DEBIT ? Side.CREDIT : Side.DEBIT, entry.amount())).toList());
    }

    private static BigDecimal amount(BigDecimal value) {
        if (value == null || value.signum() < 0) { throw new IllegalArgumentException("invalid amount"); }
        try {
            return value.setScale(2, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException exception) {
            throw new IllegalArgumentException("amount must use two decimals", exception);
        }
    }
}
