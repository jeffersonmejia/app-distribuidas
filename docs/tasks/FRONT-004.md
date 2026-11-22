# FRONT-004 — Interfaz de inventario y ventas

Issue: [#34](https://github.com/jeffersonmejia/app-distribuidas/issues/34) · Responsable: Dayanara (`Dayanarablb`)

## Lógica

- Consultar disponibilidad y registrar ventas únicamente por las APIs de Inventory y POS.
- El backend autoriza cada petición para el actor y tenant validados; la UI no autoriza mediante `tenant_id` o permisos enviados por el usuario.
- La venta solo se presenta como confirmada después de una respuesta de éxito del backend. Stock insuficiente y errores permanecen visibles y no simulan un descuento.
- Las listas usan paginación del servidor de máximo 5; los estados de carga, éxito y error son distinguibles.
- El catálogo expone SKU único por tenant, precios/costos USD a dos decimales, existencia inicial y unidad obligatoria; POS-002 recibe `saleId` y líneas con unidad, cantidad, precio e impuesto.

## Dependencias

FRONT-001/002, INV-003 y POS-002. Rutas y DTOs aprobados por Jefferson están en `docs/api-contracts.md`.
