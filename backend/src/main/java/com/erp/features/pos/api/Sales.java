package com.erp.features.pos.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.erp.features.tenancy.api.TenantId;

//SOLID: ISP — ESTE CONTRATO EXPONE EL REGISTRO TRANSACCIONAL DE VENTAS.
public interface Sales {
    //SOLID: SRP — ESTA LÍNEA CONTIENE LA SOLICITUD DE UN PRODUCTO.
    record Line(UUID productId, String unit, BigDecimal quantity, BigDecimal unitPrice, BigDecimal taxAmount) {}
    //SOLID: SRP — ESTE COMANDO CONTIENE LA IDENTIDAD Y LAS LÍNEAS DE UNA VENTA.
    record Command(UUID saleId, List<Line> lines) {
        public Command {
            if (lines != null) { lines = java.util.Collections.unmodifiableList(new java.util.ArrayList<>(lines)); }
        }
    }
    //SOLID: SRP — ESTA LÍNEA EXPONE EL SNAPSHOT DE UNA VENTA CONFIRMADA.
    record SoldLine(UUID productId, String unit, BigDecimal quantity, BigDecimal unitPrice,
                    BigDecimal taxAmount, BigDecimal netAmount) {}
    //SOLID: SRP — ESTA VISTA EXPONE LA VENTA CONFIRMADA Y SU MOVIMIENTO.
    record Sale(UUID saleId, UUID movementId, Instant createdAt, List<SoldLine> lines) {
        public Sale { lines = List.copyOf(lines); }
    }
    //SOLID: SRP — TRANSPORTA UNA PÁGINA DE VENTAS CONFIRMADAS.
    record Page(List<Sale> items, int page, int size, boolean hasNext) {
        public Page { items = List.copyOf(items); }
    }
    Sale register(TenantId tenant, Command command);
    Page list(TenantId tenant, String search, int page, int size);
    Sale get(TenantId tenant, UUID saleId);
}
