package com.erp.features.crm.domain.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

//SOLID: SRP — ESTA SUITE VERIFICA LOS CAMBIOS DE ESTADO Y LA AUDITORÍA DEL CLIENTE.
class CustomerTest {
    @Test
    void preservesIdentityAndStatusThroughChanges() {
        UUID id = UUID.randomUUID();
        UUID tenant = UUID.randomUUID();
        UUID creator = UUID.randomUUID();
        UUID editor = UUID.randomUUID();
        Instant created = Instant.parse("2026-01-01T00:00:00Z");
        Instant changed = Instant.parse("2026-01-02T00:00:00Z");
        Customer customer = Customer.create(id, tenant, new CustomerDetails("Ana", null, null, null), creator, created);
        assertEquals(CustomerStatus.ACTIVE, customer.status());
        Customer updated = customer.update(new CustomerDetails("Ana Pérez", null, null, null), editor, changed)
                .changeStatus(CustomerStatus.INACTIVE, editor, changed)
                .archive(editor, changed);
        assertEquals(id, updated.id());
        assertEquals(tenant, updated.tenantId());
        assertEquals(created, updated.createdAt());
        assertEquals(creator, updated.createdBy());
        assertEquals(editor, updated.updatedBy());
        assertEquals(changed, updated.deletedAt());
        Customer restored = updated.restore(editor, changed);
        assertEquals(CustomerStatus.INACTIVE, restored.status());
        assertNull(restored.deletedAt());
    }
}
