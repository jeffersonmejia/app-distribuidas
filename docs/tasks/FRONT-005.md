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

## Decisión de disponibilidad del backend (2026-11-23)

FRONT-005 puede avanzar contra el backend integrado; Dayanara no necesita esperar otra implementación de endpoints. `develop` ya contiene los controladores de Projects, Marketing y Accounting y sus contratos están registrados en `docs/api-contracts.md`. El frontend contiene los adaptadores `ProjectApiRepository`, `MarketingApiRepository` y `AccountingApiRepository`, seleccionables con `VITE_DATA_SOURCE=api`.

La ruta local de trabajo es ejecutar el backend integrado y configurar la fuente API y la sesión de desarrollo siguiendo las instrucciones vigentes del repositorio. El modo por defecto sigue siendo `mock`, por lo que las pantallas no consumen backend hasta seleccionar `api`. Esta decisión confirma disponibilidad de contratos e implementación, no certifica que un entorno remoto esté desplegado ni sustituye la verificación de integración de Dayanara.

Si una petición real descubre una incompatibilidad, registrar método, ruta, DTO/error esperado y evidencia sin secretos; no crear endpoints ni reglas nuevas desde el frontend. Los estados, paginación, restricciones contables y pruebas de FRONT-005 siguen pendientes.
