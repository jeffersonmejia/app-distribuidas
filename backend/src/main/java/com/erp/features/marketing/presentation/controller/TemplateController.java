package com.erp.features.marketing.presentation.controller;

import java.net.URI;
import java.util.UUID;
import com.erp.features.marketing.application.dto.PageView;
import com.erp.features.marketing.application.dto.TemplateInput;
import com.erp.features.marketing.application.dto.TemplateView;
import com.erp.features.marketing.application.usecase.TemplateService;
import com.erp.features.tenancy.api.TenantId;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

//SOLID: SRP — ESTE ADAPTADOR TRADUCE SOLICITUDES HTTP A CASOS DE USO DE PLANTILLAS.
@RestController
@RequestMapping("/api/v1/marketing/templates")
public class TemplateController {
    private final TemplateService service;

    public TemplateController(TemplateService service) { this.service = service; }

    @PostMapping
    ResponseEntity<TemplateView> create(@RequestHeader("X-Tenant-ID") UUID tenant, @RequestBody TemplateInput input) {
        TemplateView result = service.create(new TenantId(tenant), input);
        return ResponseEntity.created(URI.create("/api/v1/marketing/templates/" + result.id())).body(result);
    }

    @GetMapping
    PageView<TemplateView> list(@RequestHeader("X-Tenant-ID") UUID tenant,
                                @RequestParam(defaultValue = "0") int page,
                                @RequestParam(defaultValue = "5") int size) {
        return service.list(new TenantId(tenant), page, size);
    }

    @GetMapping("/{id}")
    TemplateView get(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id) {
        return service.get(new TenantId(tenant), id);
    }

    @PutMapping("/{id}")
    TemplateView update(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id,
                        @RequestBody TemplateInput input) {
        return service.update(new TenantId(tenant), id, input);
    }
}
