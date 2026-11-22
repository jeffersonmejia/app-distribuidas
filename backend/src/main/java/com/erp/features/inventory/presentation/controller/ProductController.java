package com.erp.features.inventory.presentation.controller;

import java.net.URI;
import java.util.UUID;
import com.erp.features.inventory.api.InventoryMovements.Availability;
import com.erp.features.inventory.application.usecase.ProductCatalogService;
import com.erp.features.inventory.application.usecase.ProductCatalogService.ProductInput;
import com.erp.features.inventory.application.usecase.ProductCatalogService.ProductPage;
import com.erp.features.inventory.application.usecase.ProductCatalogService.ProductView;
import com.erp.features.inventory.application.usecase.ProductCatalogService.ProductMetrics;
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

//SOLID: SRP — ESTE ADAPTADOR TRADUCE HTTP AL CATÁLOGO PÚBLICO DE INVENTORY.
@RestController
@RequestMapping("/api/v1/inventory/products")
public class ProductController {
    private final ProductCatalogService service;
    //SOLID: DIP — EL CONTROLADOR DEPENDE DEL CASO DE USO DE CATÁLOGO.
    public ProductController(ProductCatalogService service) { this.service = service; }

    //SOLID: SRP — CREA UN PRODUCTO Y SU EXISTENCIA INICIAL.
    @PostMapping
    ResponseEntity<ProductView> create(@RequestHeader("X-Tenant-ID") UUID tenant, @RequestBody ProductInput input) {
        ProductView created = service.create(new TenantId(tenant), input);
        return ResponseEntity.created(URI.create("/api/v1/inventory/products/" + created.id())).body(created);
    }

    //SOLID: SRP — LISTA PRODUCTOS CON FILTROS Y PÁGINA DE MÁXIMO CINCO ELEMENTOS.
    @GetMapping
    ProductPage list(@RequestHeader("X-Tenant-ID") UUID tenant,
                     @RequestParam(required = false) String search,
                     @RequestParam(required = false) String category,
                     @RequestParam(defaultValue = "0") int page,
                     @RequestParam(defaultValue = "5") int size) {
        return service.list(new TenantId(tenant), search, category, page, size);
    }

    //SOLID: SRP — OBTIENE MÉTRICAS AGREGADAS DEL CATÁLOGO Y SUS EXISTENCIAS.
    @GetMapping("/metrics")
    ProductMetrics metrics(@RequestHeader("X-Tenant-ID") UUID tenant) {
        return service.metrics(new TenantId(tenant));
    }

    //SOLID: SRP — OBTIENE EL DETALLE DE UN PRODUCTO DEL TENANT VALIDADO.
    @GetMapping("/{id}")
    ProductView get(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id) {
        return service.get(new TenantId(tenant), id);
    }

    //SOLID: SRP — ACTUALIZA DATOS DEL CATÁLOGO SIN CAMBIAR LA UNIDAD O EXISTENCIA.
    @PutMapping("/{id}")
    ProductView update(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id,
                       @RequestBody ProductInput input) {
        return service.update(new TenantId(tenant), id, input);
    }

    //SOLID: SRP — CONSULTA DISPONIBILIDAD MEDIANTE TENANT ACCESS.
    @GetMapping("/{id}/availability")
    Availability availability(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id) {
        return service.availability(new TenantId(tenant), id);
    }
}
