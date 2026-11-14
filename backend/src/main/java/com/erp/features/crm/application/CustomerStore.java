package com.erp.features.crm.application;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.erp.features.crm.domain.model.Customer;
import com.erp.features.crm.domain.model.CustomerStatus;

//SOLID: DIP — ESTE PUERTO SEPARA LOS CASOS DE USO DE LA PERSISTENCIA.
public interface CustomerStore {
    record Page(List<Customer> items, boolean hasNext) { }
    Optional<Customer> find(UUID tenantId, UUID id);
    boolean cedulaExists(UUID tenantId, String cedula, UUID excludingId);
    boolean emailExists(UUID tenantId, String email, UUID excludingId);
    Customer save(Customer customer);
    Page search(UUID tenantId, String search, CustomerStatus status, int page, int size);
    List<Customer> findActive(UUID tenantId, List<UUID> ids);
}
