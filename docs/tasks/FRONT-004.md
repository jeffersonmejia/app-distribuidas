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

## Decisión de disponibilidad del backend (2026-11-23)

FRONT-004 puede avanzar contra el backend integrado; Dayanara no necesita esperar otra implementación de endpoints. `develop` ya contiene los controladores tenant-scoped de Inventory y POS y los contratos están registrados en `docs/api-contracts.md`. El frontend también contiene `InventoryApiRepository` y `PosApiRepository`, seleccionables con `VITE_DATA_SOURCE=api`.

La ruta local de trabajo es ejecutar el backend integrado y configurar la fuente API y la sesión de desarrollo siguiendo las instrucciones vigentes del repositorio. El modo por defecto sigue siendo `mock`, por lo que las pantallas no consumen backend hasta seleccionar `api`. Esta decisión confirma disponibilidad de contratos e implementación, no certifica que un entorno remoto esté desplegado ni sustituye la verificación de integración de Dayanara.

Si una petición real descubre una incompatibilidad, registrar método, ruta, DTO/error esperado y evidencia sin secretos; no crear endpoints ni reglas nuevas desde el frontend. Las restricciones funcionales y pruebas de FRONT-004 siguen pendientes.
