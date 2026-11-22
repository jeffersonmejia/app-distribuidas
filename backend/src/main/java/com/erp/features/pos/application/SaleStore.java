package com.erp.features.pos.application;

import java.util.Optional;
import java.util.UUID;
import java.util.List;
import com.erp.features.pos.api.Sales.Sale;

//SOLID: DIP — ESTE PUERTO AÍSLA EL CASO DE USO DE SU PERSISTENCIA.
public interface SaleStore {
    //SOLID: SRP — ESTE TIPO ASOCIA LA HUELLA CON SU VENTA.
    record StoredSale(String fingerprint, Sale sale) {}
    //SOLID: SRP — REPRESENTA LA PÁGINA PERSISTIDA Y SU INDICADOR DE CONTINUACIÓN.
    record Slice(List<Sale> items, boolean hasNext) {}
    Optional<StoredSale> find(UUID tenantId, UUID saleId);
    Slice list(UUID tenantId, UUID saleId, int page, int size);
    void save(UUID tenantId, UUID actorId, String fingerprint, Sale sale);
}
