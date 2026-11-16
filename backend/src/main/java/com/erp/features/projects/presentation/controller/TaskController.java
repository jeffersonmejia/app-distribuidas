package com.erp.features.projects.presentation.controller;

import java.net.URI;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import com.erp.features.projects.application.dto.PageView;
import com.erp.features.projects.application.dto.TaskInput;
import com.erp.features.projects.application.dto.TaskView;
import com.erp.features.projects.application.usecase.TaskService;
import com.erp.features.projects.domain.model.TaskPriority;
import com.erp.features.projects.domain.model.TaskStatus;
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

//SOLID: SRP — ESTE ADAPTADOR TRADUCE SOLICITUDES HTTP A CASOS DE USO DE TAREAS.
@RestController
@RequestMapping("/api/v1/projects/{projectId}/tasks")
public class TaskController {
    private static final Map<String, Class<?>> PATCHABLE = Map.of("title", String.class,
            "description", String.class, "assigneeId", UUID.class, "priority", TaskPriority.class,
            "dueDate", LocalDate.class);
    private final TaskService service;
    private final ObjectMapper mapper;

    public TaskController(TaskService service, ObjectMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @PostMapping
    ResponseEntity<TaskView> create(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID projectId,
                                    @RequestBody TaskInput input) {
        TaskView result = service.create(new TenantId(tenant), projectId, input);
        return ResponseEntity.created(URI.create("/api/v1/projects/" + projectId + "/tasks/" + result.id()))
                .body(result);
    }

    @GetMapping
    PageView<TaskView> list(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID projectId,
                            @RequestParam(required = false) TaskStatus status,
                            @RequestParam(defaultValue = "false") boolean deleted,
                            @RequestParam(defaultValue = "0") int page,
                            @RequestParam(defaultValue = "5") int size) {
        return service.list(new TenantId(tenant), projectId, status, deleted, page, size);
    }

    @GetMapping("/{id}")
    TaskView get(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID projectId, @PathVariable UUID id) {
        return service.get(new TenantId(tenant), projectId, id);
    }

    @PatchMapping("/{id}")
    TaskView update(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID projectId,
                    @PathVariable UUID id, @RequestBody JsonNode body) {
        return service.update(new TenantId(tenant), projectId, id,
                PatchFields.parse(mapper, body, PATCHABLE, "INVALID_TASK_DATA"));
    }

    @PatchMapping("/{id}/status")
    TaskView status(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID projectId,
                    @PathVariable UUID id, @RequestBody StatusInput input) {
        return service.changeStatus(new TenantId(tenant), projectId, id, input.status());
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID projectId,
                                @PathVariable UUID id) {
        service.delete(new TenantId(tenant), projectId, id);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @PostMapping("/{id}/restore")
    TaskView restore(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID projectId,
                     @PathVariable UUID id) {
        return service.restore(new TenantId(tenant), projectId, id);
    }

    @DeleteMapping("/{id}/permanent")
    ResponseEntity<Void> purge(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID projectId,
                               @PathVariable UUID id) {
        service.purge(new TenantId(tenant), projectId, id);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    //SOLID: SRP — ESTE CONTRATO TRANSPORTA EL ESTADO SOLICITADO.
    public record StatusInput(TaskStatus status) { }
}
