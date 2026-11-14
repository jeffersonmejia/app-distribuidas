package com.erp.features.crm.application;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Optional;
import java.util.UUID;
import com.erp.features.crm.api.CustomerInput;
import com.erp.features.crm.domain.model.Customer;
import com.erp.features.crm.domain.model.CustomerDetails;
import com.erp.features.crm.domain.model.CustomerStatus;
import com.erp.features.identity.api.ActorId;
import com.erp.features.tenancy.api.TenantAccess;
import com.erp.features.tenancy.api.TenantContext;
import com.erp.features.tenancy.api.TenantId;
import com.erp.features.tenancy.api.TenantOperation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

//SOLID: SRP — ESTA SUITE COMPRUEBA LOS CASOS DE USO DE CLIENTES Y SUS PERMISOS.
class CustomerServiceTest {
    private final TenantAccess access = mock(TenantAccess.class);
    private final CustomerStore store = mock(CustomerStore.class);
    private final TenantId tenant = new TenantId(UUID.randomUUID());
    private final ActorId actor = new ActorId(UUID.randomUUID());
    private final CustomerService service = new CustomerService(access, store);
    private Customer customer;

    @BeforeEach
    void setup() {
        when(access.execute(any(), anyString(), any())).thenAnswer(invocation -> {
            TenantId requested = invocation.getArgument(0);
            TenantOperation<?> operation = invocation.getArgument(2);
            return operation.apply(new TenantContext(requested, actor));
        });
        when(store.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        customer = Customer.create(UUID.randomUUID(), tenant.value(),
                new CustomerDetails("Ana", "1710034065", "ana@example.com", "123"),
                actor.value(), Instant.parse("2026-01-01T00:00:00Z"));
    }

    @Test
    void createAndDuplicatesUseAuthorizedTenant() {
        assertEquals("ACTIVE", service.create(tenant, new CustomerInput(" Ana ", null, null, null)).status());
        verify(access).execute(eq(tenant), eq("crm:customers:create"), any());
        when(store.cedulaExists(eq(tenant.value()), eq("1710034065"), any())).thenReturn(true);
        assertEquals("CUSTOMER_CEDULA_ALREADY_EXISTS", assertThrows(CustomerException.class,
                () -> service.create(tenant, new CustomerInput("Ana", "1710034065", null, null))).code());
        when(store.emailExists(eq(tenant.value()), eq("ana@example.com"), any())).thenReturn(true);
        assertEquals("CUSTOMER_EMAIL_ALREADY_EXISTS", assertThrows(CustomerException.class,
                () -> service.create(tenant, new CustomerInput("Ana", null, "ANA@example.com", null))).code());
    }

    @Test
    void updateStatusArchiveAndRestoreKeepTenantAndAudit() {
        when(store.find(tenant.value(), customer.id())).thenReturn(Optional.of(customer));
        Map<String, String> patch = new HashMap<>();
        patch.put("phone", null);
        assertNull(service.update(tenant, customer.id(), patch).phone());
        assertEquals("INACTIVE", service.changeStatus(tenant, customer.id(), CustomerStatus.INACTIVE).status());
        service.archive(tenant, customer.id());
        Customer archived = customer.changeStatus(CustomerStatus.INACTIVE, actor.value(), Instant.now())
                .archive(actor.value(), Instant.now());
        when(store.find(tenant.value(), customer.id())).thenReturn(Optional.of(archived));
        assertEquals("INACTIVE", service.restore(tenant, customer.id()).status());
        verify(access, times(2)).execute(eq(tenant), eq("crm:customers:update"), any());
        verify(access, times(2)).execute(eq(tenant), eq("crm:customers:archive"), any());
    }

    @Test
    void readAndMarketingOnlyReceiveTenantScopedResults() {
        when(store.find(tenant.value(), customer.id())).thenReturn(Optional.of(customer));
        assertEquals(customer.id(), service.get(tenant, customer.id()).id());
        when(store.search(eq(tenant.value()), eq("ana"), eq(CustomerStatus.ACTIVE), eq(0), eq(5)))
                .thenReturn(new CustomerStore.Page(List.of(customer), false));
        assertEquals(1, service.list(tenant, " Ana ", CustomerStatus.ACTIVE, 0, 5).items().size());
        when(store.findActive(tenant.value(), List.of(customer.id()))).thenReturn(List.of(customer));
        assertEquals("ana@example.com", service.findActive(tenant, List.of(customer.id())).get(0).email());
        assertThrows(CustomerException.class, () -> service.list(tenant, null, null, 0, 6));
        verify(access, times(3)).execute(eq(tenant), eq("crm:customers:read"), any());
    }

    @Test
    void missingOrArchivedAreNotFoundAndAuthorizationPrecedesAccess() {
        when(store.find(tenant.value(), customer.id())).thenReturn(Optional.empty());
        assertEquals("CUSTOMER_NOT_FOUND", assertThrows(CustomerException.class,
                () -> service.get(tenant, customer.id())).code());
        when(store.find(tenant.value(), customer.id())).thenReturn(Optional.of(customer.archive(actor.value(), Instant.now())));
        assertEquals("CUSTOMER_NOT_FOUND", assertThrows(CustomerException.class,
                () -> service.get(tenant, customer.id())).code());
        reset(store);
        doThrow(new AccessDeniedException("denied")).when(access).execute(eq(tenant), anyString(), any());
        assertThrows(AccessDeniedException.class, () -> service.get(tenant, customer.id()));
        verifyNoInteractions(store);
    }
}
