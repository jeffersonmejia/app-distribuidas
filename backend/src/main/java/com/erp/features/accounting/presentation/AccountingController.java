package com.erp.features.accounting.presentation;

import java.util.List;
import java.util.UUID;
import com.erp.features.accounting.api.AccountingEntries;
import com.erp.features.tenancy.api.TenantId;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

//SOLID: SRP — ESTE ADAPTADOR EXPONE CONSULTAS DE ASIENTOS EXISTENTES.
@RestController
@RequestMapping("/api/v1/accounting/entries")
public class AccountingController {
    private final AccountingEntries entries;
    //SOLID: DIP — EL CONTROLADOR DEPENDE DEL CONTRATO PÚBLICO CONTABLE.
    public AccountingController(AccountingEntries entries) { this.entries = entries; }

    //SOLID: SRP — LISTA ASIENTOS PAGINADOS CON MÁXIMO CINCO RESULTADOS.
    @GetMapping
    EntryPage list(@RequestHeader("X-Tenant-ID") UUID tenant,
                   @RequestParam(required = false) String search,
                   @RequestParam(required = false) String period,
                   @RequestParam(defaultValue = "0") int page,
                   @RequestParam(defaultValue = "5") int size) {
        AccountingEntries.Page pageView = entries.list(new TenantId(tenant), search, period, page, size);
        return new EntryPage(pageView.items().stream().map(AccountingController::view).toList(),
                pageView.page(), pageView.size(), pageView.hasNext());
    }

    //SOLID: SRP — OBTIENE UN ASIENTO Y SUS MOVIMIENTOS.
    @GetMapping("/{id}")
    EntryView get(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID id) {
        return view(entries.get(new TenantId(tenant), id));
    }

    //SOLID: SRP — DEVUELVE TOTALES CALCULADOS DESDE LOS MOVIMIENTOS EXISTENTES.
    @GetMapping("/summary")
    SummaryView summary(@RequestHeader("X-Tenant-ID") UUID tenant) {
        var summary = entries.summary(new TenantId(tenant));
        return new SummaryView(summary.totalEntries(), summary.totalDebit().toPlainString(), summary.totalCredit().toPlainString());
    }

    //SOLID: SRP — CONVIERTE IMPORTES A CADENAS DECIMALES PRECISAS.
    private static EntryView view(AccountingEntries.Entry entry) {
        List<MovementView> movements = entry.movements().stream()
                .map(movement -> new MovementView(movement.account(), movement.side(), movement.amount().toPlainString())).toList();
        return new EntryView(entry.id(), entry.saleId(), entry.reversalId(), entry.originalId(), entry.createdAt(), movements);
    }

    //SOLID: SRP — TRANSPORTA UN ASIENTO PERSISTIDO Y SUS MOVIMIENTOS.
    public record EntryView(UUID id, UUID saleId, UUID reversalId, UUID originalId, java.time.Instant createdAt,
                            List<MovementView> movements) {}
    //SOLID: SRP — TRANSPORTA UNA LÍNEA CONTABLE PERSISTIDA.
    public record MovementView(String account, String side, String amount) {}
    //SOLID: SRP — TRANSPORTA UNA PÁGINA DE ASIENTOS.
    public record EntryPage(List<EntryView> items, int page, int size, boolean hasNext) {}
    //SOLID: SRP — TRANSPORTA TOTALES AGREGADOS DESDE LOS ASIENTOS.
    public record SummaryView(long totalEntries, String totalDebit, String totalCredit) {}
}
