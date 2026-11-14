package com.erp.features.crm.domain.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

//SOLID: SRP — ESTA SUITE COMPRUEBA LAS REGLAS DE DATOS DEL CLIENTE.
class CustomerDetailsTest {
    @Test
    void normalizesOptionalValues() {
        CustomerDetails details = new CustomerDetails("  Ana Pérez  ", " 1710034065 ", " ANA@EXAMPLE.COM ", " 123 ");
        assertEquals("Ana Pérez", details.fullName());
        assertEquals("1710034065", details.cedula());
        assertEquals("ana@example.com", details.email());
        assertEquals("123", details.phone());
        CustomerDetails empty = new CustomerDetails("Ana", " ", null, " ");
        assertNull(empty.cedula());
        assertNull(empty.email());
        assertNull(empty.phone());
    }

    @Test
    void rejectsInvalidData() {
        assertThrows(IllegalArgumentException.class, () -> new CustomerDetails(" ", null, null, null));
        assertThrows(IllegalArgumentException.class, () -> new CustomerDetails("Ana", "171003406", null, null));
        assertThrows(IllegalArgumentException.class, () -> new CustomerDetails("Ana", "171003406a", null, null));
        assertThrows(IllegalArgumentException.class, () -> new CustomerDetails("Ana", "1710034064", null, null));
        assertThrows(IllegalArgumentException.class, () -> new CustomerDetails("Ana", "9910034065", null, null));
        assertThrows(IllegalArgumentException.class, () -> new CustomerDetails("Ana", null, "invalid", null));
        assertThrows(IllegalArgumentException.class, () -> new CustomerDetails("Ana", null, "a..b@example.com", null));
        assertThrows(IllegalArgumentException.class, () -> new CustomerDetails("Ana", null, "a@-example.com", null));
    }
}
