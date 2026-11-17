package com.erp.features.marketing.presentation.controller;

import java.util.UUID;
import com.erp.features.marketing.application.usecase.ConsentService;
import com.erp.features.tenancy.api.TenantId;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

//SOLID: SRP — ESTE ADAPTADOR TRADUCE SOLICITUDES HTTP A CASOS DE USO DE CONSENTIMIENTO Y BAJA.
@RestController
@RequestMapping("/api/v1/marketing/contacts/{customerId}")
public class ConsentController {
    private final ConsentService service;

    public ConsentController(ConsentService service) { this.service = service; }

    @PutMapping("/consent")
    ResponseEntity<Void> consent(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID customerId) {
        service.consent(new TenantId(tenant), customerId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/unsubscribe")
    ResponseEntity<Void> unsubscribe(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID customerId) {
        service.unsubscribe(new TenantId(tenant), customerId);
        return ResponseEntity.noContent().build();
    }
}
