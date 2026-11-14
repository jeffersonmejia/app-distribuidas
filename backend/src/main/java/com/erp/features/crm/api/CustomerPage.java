package com.erp.features.crm.api;

import java.util.List;

//SOLID: SRP — ESTE CONTRATO TRANSPORTA UNA PÁGINA DE CLIENTES.
public record CustomerPage(List<CustomerView> items, int page, int size, boolean hasNext) { }
