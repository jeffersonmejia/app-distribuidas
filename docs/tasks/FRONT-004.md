# FRONT-004 — Interfaz de inventario y ventas

Issue: [#34](https://github.com/jeffersonmejia/app-distribuidas/issues/34) · Responsable: Dayanara (`Dayanarablb`)

## Lógica

- Consultar disponibilidad y registrar ventas únicamente por las APIs de Inventory y POS.
- El backend autoriza cada petición para el actor y tenant validados; la UI no autoriza mediante `tenant_id` o permisos enviados por el usuario.
- La venta solo se presenta como confirmada después de una respuesta de éxito del backend. Stock insuficiente y errores permanecen visibles y no simulan un descuento.
- Las listas usan paginación del servidor de máximo 5; los estados de carga, éxito y error son distinguibles.

## Dependencias

FRONT-001/002, INV-003 y POS-002. No anticipar campos ni rutas HTTP que los contratos backend aún no hayan aprobado.
