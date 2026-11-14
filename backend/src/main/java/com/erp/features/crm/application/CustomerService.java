package com.erp.features.crm.application;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import com.erp.features.crm.api.ActiveCustomers;
import com.erp.features.crm.api.CustomerInput;
import com.erp.features.crm.api.CustomerPage;
import com.erp.features.crm.api.CustomerView;
import com.erp.features.crm.api.MarketingCustomer;
import com.erp.features.crm.domain.model.Customer;
import com.erp.features.crm.domain.model.CustomerDetails;
import com.erp.features.crm.domain.model.CustomerStatus;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantContext;
import com.erp.features.tenancy.api.TenantId;
import org.springframework.stereotype.Service;

//SOLID: SRP — ESTE SERVICIO COORDINA LOS CASOS DE USO AUTORIZADOS DE CLIENTES.
@Service
public class CustomerService implements ActiveCustomers {
    private static final String READ = "crm:customers:read";
    private static final String CREATE = "crm:customers:create";
    private static final String UPDATE = "crm:customers:update";
    private static final String ARCHIVE = "crm:customers:archive";
    private final TenantAccess access;
    private final CustomerStore store;

    public CustomerService(TenantAccess access, CustomerStore store) {
        this.access = access;
        this.store = store;
    }

    public CustomerView create(TenantId tenant, CustomerInput input) {
        return access.execute(tenant, CREATE, context -> {
            Customer customer = Customer.create(UUID.randomUUID(), context.tenantId().value(), details(input),
                    context.actorId().value(), Instant.now());
            return view(saveChecked(customer));
        });
    }

    public CustomerPage list(TenantId tenant, String search, CustomerStatus status, int page, int size) {
        if (page < 0 || size < 1 || size > 5) { throw new CustomerException("INVALID_CUSTOMER_DATA"); }
        String term = search == null || search.isBlank() ? null : search.trim().toLowerCase(Locale.ROOT);
        return access.execute(tenant, READ, context -> {
            CustomerStore.Page result = store.search(context.tenantId().value(), term, status, page, size);
            return new CustomerPage(result.items().stream().map(CustomerService::view).toList(),
                    page, size, result.hasNext());
        });
    }

    public CustomerView get(TenantId tenant, UUID id) {
        return access.execute(tenant, READ, context -> view(get(context, id, false)));
    }

    public CustomerView update(TenantId tenant, UUID id, java.util.Map<String, String> fields) {
        return access.execute(tenant, UPDATE, context -> {
            Customer customer = get(context, id, false);
            CustomerDetails old = customer.details();
            CustomerDetails updated = details(new CustomerInput(fields.getOrDefault("fullName", old.fullName()),
                    fields.getOrDefault("cedula", old.cedula()), fields.getOrDefault("email", old.email()),
                    fields.getOrDefault("phone", old.phone())));
            return view(saveChecked(customer.update(updated, context.actorId().value(), Instant.now())));
        });
    }

    public CustomerView changeStatus(TenantId tenant, UUID id, CustomerStatus status) {
        if (status == null) { throw new CustomerException("INVALID_CUSTOMER_DATA"); }
        return access.execute(tenant, UPDATE, context -> view(store.save(
                get(context, id, false).changeStatus(status, context.actorId().value(), Instant.now()))));
    }

    public void archive(TenantId tenant, UUID id) {
        access.execute(tenant, ARCHIVE, context -> {
            store.save(get(context, id, false).archive(context.actorId().value(), Instant.now()));
            return null;
        });
    }

    public CustomerView restore(TenantId tenant, UUID id) {
        return access.execute(tenant, ARCHIVE, context -> view(saveChecked(
                get(context, id, true).restore(context.actorId().value(), Instant.now()))));
    }

    @Override public List<MarketingCustomer> findActive(TenantId tenant, List<UUID> customerIds) {
        if (customerIds == null || customerIds.stream().anyMatch(java.util.Objects::isNull)) {
            throw new CustomerException("INVALID_CUSTOMER_DATA");
        }
        return access.execute(tenant, READ, context -> store.findActive(context.tenantId().value(), customerIds)
                .stream().map(c -> new MarketingCustomer(c.id(), c.details().fullName(),
                        c.details().email(), c.details().phone())).toList());
    }

    private Customer get(TenantContext context, UUID id, boolean archived) {
        return store.find(context.tenantId().value(), id)
                .filter(customer -> (customer.deletedAt() != null) == archived)
                .orElseThrow(() -> new CustomerException("CUSTOMER_NOT_FOUND"));
    }

    private Customer saveChecked(Customer customer) {
        if (store.cedulaExists(customer.tenantId(), customer.details().cedula(), customer.id())) {
            throw new CustomerException("CUSTOMER_CEDULA_ALREADY_EXISTS");
        }
        if (store.emailExists(customer.tenantId(), customer.details().email(), customer.id())) {
            throw new CustomerException("CUSTOMER_EMAIL_ALREADY_EXISTS");
        }
        return store.save(customer);
    }

    private static CustomerDetails details(CustomerInput input) {
        if (input == null) { throw new CustomerException("INVALID_CUSTOMER_DATA"); }
        try {
            return new CustomerDetails(input.fullName(), input.cedula(), input.email(), input.phone());
        } catch (IllegalArgumentException exception) {
            throw new CustomerException("INVALID_CUSTOMER_DATA");
        }
    }

    private static CustomerView view(Customer customer) {
        CustomerDetails d = customer.details();
        return new CustomerView(customer.id(), d.fullName(), d.cedula(), d.email(), d.phone(),
                customer.status().name(), customer.createdAt(), customer.updatedAt());
    }
}
