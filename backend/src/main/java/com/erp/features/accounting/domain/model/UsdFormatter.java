package com.erp.features.accounting.domain.model;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.util.Locale;

//SOLID: SRP — ESTA CLASE FORMATEA IMPORTES USD CON DOS DECIMALES.
public final class UsdFormatter {
    private UsdFormatter() {}

    public static String format(BigDecimal amount) {
        NumberFormat formatter = NumberFormat.getNumberInstance(Locale.US);
        formatter.setMinimumFractionDigits(2);
        formatter.setMaximumFractionDigits(2);
        formatter.setRoundingMode(RoundingMode.UNNECESSARY);
        return formatter.format(amount);
    }
}
