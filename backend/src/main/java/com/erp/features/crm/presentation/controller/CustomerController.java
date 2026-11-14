package com.erp.features.crm.presentation.controller;

import java.net.URI;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import com.erp.features.crm.api.CustomerInput;
import com.erp.features.crm.api.CustomerPage;
import com.erp.features.crm.api.CustomerView;
import com.erp.features.crm.application.CustomerException;
import com.erp.features.crm.application.CustomerService;
import com.erp.features.crm.domain.model.CustomerStatus;
import com.erp.features.tenancy.api.TenantId;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

//SOLID: SRP — ESTE ADAPTADOR TRADUCE SOLICITUDES HTTP A CASOS DE USO DE CLIENTES.
@RestController
@RequestMapping("/api/v1/crm/customers")
public class CustomerController {
    private final CustomerService service;
    public CustomerController(CustomerService service) { this.service = service; }

    @PostMapping
    ResponseEntity<CustomerView> create(@RequestHeader("X-Tenant-ID") UUID tenant, @RequestBody CustomerInput input) {
        CustomerView result = service.create(new TenantId(tenant), input);
        return ResponseEntity.created(URI.create("/api/v1/crm/customers/" + result.id())).body(result);
    }

    @GetMapping
    CustomerPage list(@RequestHeader("X-Tenant-ID") UUID tenant,
                      @RequestParam(required = false) String search,
                      @RequestParam(required = false) CustomerStatus status,
                      @RequestParam(defaultValue = "0") int page,
                      @RequestParam(defaultValue = "5") int size) {
        return service.list(new TenantId(tenant), search, status, page, size);
    }

    @GetMapping("/{id}")
    CustomerView get(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id) {
        return service.get(new TenantId(tenant), id);
    }

    @PatchMapping("/{id}")
    CustomerView update(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id,
                        @RequestBody JsonNode body) {
        if (!body.isObject()) { throw new CustomerException("INVALID_CUSTOMER_DATA"); }
        Map<String, String> fields = new HashMap<>();
        Set<String> allowed = Set.of("fullName", "cedula", "email", "phone");
        Iterator<Map.Entry<String, JsonNode>> entries = body.fields();
        while (entries.hasNext()) {
            Map.Entry<String, JsonNode> entry = entries.next();
            if (!allowed.contains(entry.getKey()) || !(entry.getValue().isTextual() || entry.getValue().isNull())) {
                throw new CustomerException("INVALID_CUSTOMER_DATA");
            }
            fields.put(entry.getKey(), entry.getValue().isNull() ? null : entry.getValue().textValue());
        }
        return service.update(new TenantId(tenant), id, fields);
    }

    @PatchMapping("/{id}/status")
    CustomerView status(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id,
                        @RequestBody StatusInput input) {
        return service.changeStatus(new TenantId(tenant), id, input.status());
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> archive(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id) {
        service.archive(new TenantId(tenant), id);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @PostMapping("/{id}/restore")
    CustomerView restore(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id) {
        return service.restore(new TenantId(tenant), id);
    }

    //SOLID: SRP — ESTE CONTRATO TRANSPORTA EL ESTADO SOLICITADO.
    public record StatusInput(CustomerStatus status) { }
}
