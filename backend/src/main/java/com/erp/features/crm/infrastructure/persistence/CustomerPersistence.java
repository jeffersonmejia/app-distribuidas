package com.erp.features.crm.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.erp.features.crm.application.CustomerException;
import com.erp.features.crm.application.CustomerStore;
import com.erp.features.crm.domain.model.Customer;
import com.erp.features.crm.domain.model.CustomerStatus;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

//SOLID: SRP — ESTE ADAPTADOR IMPLEMENTA LA PERSISTENCIA AISLADA POR TENANT.
@Repository
public class CustomerPersistence implements CustomerStore {
    private final CustomerJpaRepository repository;

    public CustomerPersistence(CustomerJpaRepository repository) { this.repository = repository; }

    @Override public Optional<Customer> find(UUID tenantId, UUID id) {
        return repository.findByTenantIdAndId(tenantId, id).map(CustomerEntity::toDomain);
    }
    @Override public boolean cedulaExists(UUID tenantId, String cedula, UUID excludingId) {
        return cedula != null && repository.existsByTenantIdAndCedulaAndIdNot(tenantId, cedula, excludingId);
    }
    @Override public boolean emailExists(UUID tenantId, String email, UUID excludingId) {
        return email != null && repository.existsByTenantIdAndEmailAndIdNot(tenantId, email, excludingId);
    }
    @Override public Customer save(Customer customer) {
        try {
            CustomerEntity entity = repository.findByTenantIdAndId(customer.tenantId(), customer.id())
                    .orElseGet(() -> new CustomerEntity(customer));
            entity.apply(customer);
            return repository.saveAndFlush(entity).toDomain();
        } catch (DataIntegrityViolationException exception) {
            Throwable cause = exception;
            while (cause != null) {
                if (cause instanceof org.hibernate.exception.ConstraintViolationException violation) {
                    if ("uq_crm_customer_cedula".equals(violation.getConstraintName())) {
                        throw new CustomerException("CUSTOMER_CEDULA_ALREADY_EXISTS");
                    }
                    if ("uq_crm_customer_email".equals(violation.getConstraintName())) {
                        throw new CustomerException("CUSTOMER_EMAIL_ALREADY_EXISTS");
                    }
                }
                cause = cause.getCause();
            }
            throw exception;
        }
    }
    @Override public Page search(UUID tenantId, String search, CustomerStatus status, int page, int size) {
        var result = repository.search(tenantId, status, search, PageRequest.of(page, size));
        return new Page(result.getContent().stream().map(CustomerEntity::toDomain).toList(), result.hasNext());
    }
    @Override public List<Customer> findActive(UUID tenantId, List<UUID> ids) {
        if (ids.isEmpty()) { return List.of(); }
        return repository.findByTenantIdAndIdInAndStatusAndDeletedAtIsNull(tenantId, ids, CustomerStatus.ACTIVE)
                .stream().map(CustomerEntity::toDomain).toList();
    }
}
