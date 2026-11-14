package com.erp.features.crm.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import com.erp.features.crm.domain.model.Customer;
import com.erp.features.crm.domain.model.CustomerDetails;
import com.erp.features.crm.domain.model.CustomerStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

//SOLID: SRP — ESTA ENTIDAD REPRESENTA LA PERSISTENCIA DE UN CLIENTE.
@Entity
@Table(name = "crm_customer")
public class CustomerEntity {
    @Id UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false) UUID tenantId;
    @Column(name = "full_name", nullable = false, columnDefinition = "text") String fullName;
    @Column(length = 10) String cedula;
    @Column(columnDefinition = "text") String email;
    @Column(columnDefinition = "text") String phone;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) CustomerStatus status;
    @Column(name = "created_at", nullable = false, updatable = false) Instant createdAt;
    @Column(name = "updated_at", nullable = false) Instant updatedAt;
    @Column(name = "created_by", nullable = false, updatable = false) UUID createdBy;
    @Column(name = "updated_by", nullable = false) UUID updatedBy;
    @Column(name = "deleted_at") Instant deletedAt;

    protected CustomerEntity() { }

    CustomerEntity(Customer customer) { apply(customer); }

    void apply(Customer customer) {
        id = customer.id();
        tenantId = customer.tenantId();
        fullName = customer.details().fullName();
        cedula = customer.details().cedula();
        email = customer.details().email();
        phone = customer.details().phone();
        status = customer.status();
        createdAt = customer.createdAt();
        updatedAt = customer.updatedAt();
        createdBy = customer.createdBy();
        updatedBy = customer.updatedBy();
        deletedAt = customer.deletedAt();
    }

    Customer toDomain() {
        return new Customer(id, tenantId, new CustomerDetails(fullName, cedula, email, phone),
                status, createdAt, updatedAt, createdBy, updatedBy, deletedAt);
    }
}
