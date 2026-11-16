package com.erp.features.projects.presentation.controller;

import java.net.URI;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import com.erp.features.projects.application.dto.PageView;
import com.erp.features.projects.application.dto.ProjectInput;
import com.erp.features.projects.application.dto.ProjectView;
import com.erp.features.projects.application.usecase.ProjectService;
import com.erp.features.tenancy.api.TenantId;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

//SOLID: SRP — ESTE ADAPTADOR TRADUCE SOLICITUDES HTTP A CASOS DE USO DE PROYECTOS.
@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {
    private static final Map<String, Class<?>> PATCHABLE = Map.of("name", String.class,
            "description", String.class, "startDate", LocalDate.class, "endDate", LocalDate.class);
    private final ProjectService service;
    private final ObjectMapper mapper;

    public ProjectController(ProjectService service, ObjectMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @PostMapping
    ResponseEntity<ProjectView> create(@RequestHeader("X-Tenant-ID") UUID tenant, @RequestBody ProjectInput input) {
        ProjectView result = service.create(new TenantId(tenant), input);
        return ResponseEntity.created(URI.create("/api/v1/projects/" + result.id())).body(result);
    }

    @GetMapping
    PageView<ProjectView> list(@RequestHeader("X-Tenant-ID") UUID tenant,
                               @RequestParam(required = false) String search,
                               @RequestParam(defaultValue = "false") boolean deleted,
                               @RequestParam(defaultValue = "0") int page,
                               @RequestParam(defaultValue = "5") int size) {
        return service.list(new TenantId(tenant), search, deleted, page, size);
    }

    @GetMapping("/{id}")
    ProjectView get(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id) {
        return service.get(new TenantId(tenant), id);
    }

    @PatchMapping("/{id}")
    ProjectView update(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id,
                       @RequestBody JsonNode body) {
        return service.update(new TenantId(tenant), id,
                PatchFields.parse(mapper, body, PATCHABLE, "INVALID_PROJECT_DATA"));
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id) {
        service.delete(new TenantId(tenant), id);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @PostMapping("/{id}/restore")
    ProjectView restore(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id) {
        return service.restore(new TenantId(tenant), id);
    }

    @DeleteMapping("/{id}/permanent")
    ResponseEntity<Void> purge(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id) {
        service.purge(new TenantId(tenant), id);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
