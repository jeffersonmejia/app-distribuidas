package com.erp.features.crm.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.erp.features.crm.application.CustomerException;
import com.erp.features.crm.domain.model.Customer;
import com.erp.features.crm.domain.model.CustomerDetails;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

//SOLID: SRP — ESTA SUITE VERIFICA LA TRADUCCIÓN DE CONFLICTOS DE PERSISTENCIA.
class CustomerPersistenceTest {
    @Test void translatesConcurrentUniqueConstraintFailures() {
        CustomerJpaRepository repository = mock(CustomerJpaRepository.class);
        CustomerPersistence persistence = new CustomerPersistence(repository);
        UUID tenant = UUID.randomUUID();
        Customer customer = Customer.create(UUID.randomUUID(), tenant,
                new CustomerDetails("Ana", null, null, null), UUID.randomUUID(), Instant.now());
        when(repository.findByTenantIdAndId(tenant, customer.id())).thenReturn(Optional.empty());
        when(repository.saveAndFlush(any())).thenThrow(violation("uq_crm_customer_cedula"))
                .thenThrow(violation("uq_crm_customer_email"));
        assertEquals("CUSTOMER_CEDULA_ALREADY_EXISTS",
                assertThrows(CustomerException.class, () -> persistence.save(customer)).code());
        assertEquals("CUSTOMER_EMAIL_ALREADY_EXISTS",
                assertThrows(CustomerException.class, () -> persistence.save(customer)).code());
        assertTrue(persistence.findActive(tenant, List.of()).isEmpty());
    }

    private static DataIntegrityViolationException violation(String constraint) {
        return new DataIntegrityViolationException("integrity",
                new ConstraintViolationException("unique", new SQLException(), constraint));
    }
}
