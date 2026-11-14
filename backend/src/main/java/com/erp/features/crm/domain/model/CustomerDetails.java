package com.erp.features.crm.domain.model;

import java.util.Locale;
import java.util.regex.Pattern;

//SOLID: SRP — ESTE TIPO VALIDA Y NORMALIZA LOS DATOS DE UN CLIENTE.
public record CustomerDetails(String fullName, String cedula, String email, String phone) {
    private static final Pattern EMAIL = Pattern.compile(
            "^[^\\s@.]+(?:\\.[^\\s@.]+)*@[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?"
                    + "(?:\\.[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)+$");

    public CustomerDetails {
        fullName = optional(fullName);
        if (fullName == null) {
            throw new IllegalArgumentException("fullName is required");
        }
        cedula = optional(cedula);
        if (cedula != null && !validCedula(cedula)) {
            throw new IllegalArgumentException("invalid cedula");
        }
        email = optional(email);
        if (email != null) {
            email = email.toLowerCase(Locale.ROOT);
            if (!EMAIL.matcher(email).matches()) {
                throw new IllegalArgumentException("invalid email");
            }
        }
        phone = optional(phone);
    }

    private static String optional(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private static boolean validCedula(String value) {
        if (!value.matches("[0-9]{10}")) {
            return false;
        }
        int province = Integer.parseInt(value.substring(0, 2));
        if (province < 1 || (province > 24 && province != 30) || value.charAt(2) > '5') {
            return false;
        }
        int sum = 0;
        for (int index = 0; index < 9; index++) {
            int digit = value.charAt(index) - '0';
            int product = digit * (index % 2 == 0 ? 2 : 1);
            sum += product > 9 ? product - 9 : product;
        }
        return (10 - sum % 10) % 10 == value.charAt(9) - '0';
    }
}
