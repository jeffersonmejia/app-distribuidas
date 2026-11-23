package com.erp.features.pos.presentation;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import com.erp.features.pos.api.Sales;
import com.erp.features.tenancy.api.TenantId;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

//SOLID: SRP — ESTE ADAPTADOR EXPONE CONSULTA Y REGISTRO DE VENTAS POR HTTP.
@RestController
@RequestMapping("/api/v1/pos/sales")
public class SalesController {
    private final Sales sales;
    //SOLID: DIP — EL CONTROLADOR USA EL CONTRATO PÚBLICO DE POS.
    public SalesController(Sales sales) { this.sales = sales; }

    //SOLID: SRP — REGISTRA UNA VENTA Y DEVUELVE SU REPRESENTACIÓN CONFIRMADA.
    @PostMapping
    ResponseEntity<SaleView> create(@RequestHeader("X-Tenant-ID") UUID tenant, @RequestBody Sales.Command input) {
        SaleView result = view(sales.register(new TenantId(tenant), input));
        return ResponseEntity.created(URI.create("/api/v1/pos/sales/" + result.saleId())).body(result);
    }

    //SOLID: SRP — LISTA VENTAS CONFIRMADAS CON PAGINACIÓN DE MÁXIMO CINCO.
    @GetMapping
    SalePage list(@RequestHeader("X-Tenant-ID") UUID tenant,
                  @RequestParam(required = false) String search,
                  @RequestParam(defaultValue = "0") int page,
                  @RequestParam(defaultValue = "5") int size) {
        Sales.Page result = sales.list(new TenantId(tenant), search, page, size);
        return new SalePage(result.items().stream().map(SalesController::view).toList(), result.page(), result.size(), result.hasNext());
    }

    //SOLID: SRP — CONSULTA UNA VENTA CONFIRMADA POR SU IDENTIDAD ESTABLE.
    @GetMapping("/{saleId}")
    SaleView get(@RequestHeader("X-Tenant-ID") UUID tenant, @PathVariable UUID saleId) {
        return view(sales.get(new TenantId(tenant), saleId));
    }

    //SOLID: SRP — CONVIERTE IMPORTES A CADENAS DECIMALES SIN PÉRDIDA DE PRECISIÓN JSON.
    private static SaleView view(Sales.Sale sale) {
        List<SaleLineView> lines = sale.lines().stream().map(line -> new SaleLineView(line.productId(), line.unit(),
                line.quantity().toPlainString(), line.unitPrice().toPlainString(), line.taxAmount().toPlainString(),
                line.netAmount().toPlainString())).toList();
        return new SaleView(sale.saleId(), sale.movementId(), sale.createdAt(), lines);
    }

    //SOLID: SRP — TRANSPORTA UNA VENTA Y SUS LÍNEAS DE PRECISIÓN DECIMAL.
    public record SaleView(UUID saleId, UUID movementId, java.time.Instant createdAt, List<SaleLineView> lines) {}
    //SOLID: SRP — TRANSPORTA UNA LÍNEA DE LA VENTA.
    public record SaleLineView(UUID productId, String unit, String quantity, String unitPrice,
                               String taxAmount, String netAmount) {}
    //SOLID: SRP — TRANSPORTA UNA PÁGINA DE VENTAS.
    public record SalePage(List<SaleView> items, int page, int size, boolean hasNext) {}
}
