package com.erp.features.crm.api;

import java.util.List;
import java.util.UUID;
import com.erp.features.tenancy.api.TenantId;

//SOLID: ISP — ESTE CONTRATO LIMITA A MARKETING A LA LECTURA DE CLIENTES ACTIVOS.
public interface ActiveCustomers {
    List<MarketingCustomer> findActive(TenantId tenantId, List<UUID> customerIds);
}
