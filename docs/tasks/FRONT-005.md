# FRONT-005 — Interfaces de proyectos, marketing y contabilidad

Issue: [#35](https://github.com/jeffersonmejia/app-distribuidas/issues/35) · Responsable: Dayanara (`Dayanarablb`)

## Lógica

- Cada vista consume la API pública de su feature; el cliente no consulta persistencia ni autoriza con IDs/permisos propios.
- Listas paginan en servidor con máximo 5 y muestran carga, vacío, error y éxito.
- Proyectos y Marketing reflejan únicamente estados/campos definidos por sus contratos backend.
- Contabilidad es de consulta en esta tarea; no se crean ni modifican asientos desde la UI. No mostrar reglas, moneda o precisión que no estén aprobadas.
- Accounting muestra exclusivamente los asientos y movimientos persistidos; glosa, código y estado no forman parte del contrato actual.

## Dependencias

FRONT-001/002, PROJ-001, MKT-002 y ACC-002. Rutas y DTOs aprobados por Jefferson están en `docs/api-contracts.md`.
