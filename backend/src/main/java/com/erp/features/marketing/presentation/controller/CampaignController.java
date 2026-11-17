package com.erp.features.marketing.presentation.controller;

import java.net.URI;
import java.util.UUID;
import com.erp.features.marketing.application.dto.CampaignInput;
import com.erp.features.marketing.application.dto.CampaignView;
import com.erp.features.marketing.application.dto.ContactView;
import com.erp.features.marketing.application.dto.PageView;
import com.erp.features.marketing.application.dto.SendResult;
import com.erp.features.marketing.application.usecase.CampaignSendService;
import com.erp.features.marketing.application.usecase.CampaignService;
import com.erp.features.marketing.domain.model.CampaignStatus;
import com.erp.features.tenancy.api.TenantId;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

//SOLID: SRP — ESTE ADAPTADOR TRADUCE SOLICITUDES HTTP A CASOS DE USO DE CAMPAÑAS.
@RestController
@RequestMapping("/api/v1/marketing/campaigns")
public class CampaignController {
    private final CampaignService service;
    private final CampaignSendService sender;

    public CampaignController(CampaignService service, CampaignSendService sender) {
        this.service = service;
        this.sender = sender;
    }

    @PostMapping
    ResponseEntity<CampaignView> create(@RequestHeader("X-Tenant-ID") UUID tenant, @RequestBody CampaignInput input) {
        CampaignView result = service.create(new TenantId(tenant), input);
        return ResponseEntity.created(URI.create("/api/v1/marketing/campaigns/" + result.id())).body(result);
    }

    @GetMapping
    PageView<CampaignView> list(@RequestHeader("X-Tenant-ID") UUID tenant,
                                @RequestParam(required = false) CampaignStatus status,
                                @RequestParam(defaultValue = "0") int page,
                                @RequestParam(defaultValue = "5") int size) {
        return service.list(new TenantId(tenant), status, page, size);
    }

    @GetMapping("/{id}")
    CampaignView get(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id) {
        return service.get(new TenantId(tenant), id);
    }

    @PatchMapping("/{id}/status")
    CampaignView status(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id,
                        @RequestBody StatusInput input) {
        return service.changeStatus(new TenantId(tenant), id, input.status());
    }

    @GetMapping("/{id}/contacts")
    PageView<ContactView> contacts(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id,
                                   @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "5") int size) {
        return service.contacts(new TenantId(tenant), id, page, size);
    }

    @PutMapping("/{id}/contacts/{customerId}")
    ResponseEntity<Void> addContact(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id,
                                    @PathVariable UUID customerId) {
        service.addContact(new TenantId(tenant), id, customerId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/contacts/{customerId}")
    ResponseEntity<Void> removeContact(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id,
                                       @PathVariable UUID customerId) {
        service.removeContact(new TenantId(tenant), id, customerId);
        return ResponseEntity.noContent().build();
    }

    /** Envío manual: solo ocurre cuando alguien con permiso llama a este endpoint; las fechas no lo disparan. */
    @PostMapping("/{id}/send")
    SendResult send(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id, @RequestBody SendInput input) {
        return sender.send(new TenantId(tenant), id, input.templateId());
    }

    //SOLID: SRP — ESTE CONTRATO TRANSPORTA EL ESTADO SOLICITADO.
    public record StatusInput(CampaignStatus status) { }

    //SOLID: SRP — ESTE CONTRATO TRANSPORTA LA PLANTILLA ELEGIDA PARA EL ENVÍO.
    public record SendInput(UUID templateId) { }
}
