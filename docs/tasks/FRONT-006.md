# FRONT-006 — Estabilizar prueba de métricas de inventario

Issue: [#183](https://github.com/jeffersonmejia/app-distribuidas/issues/183) · Responsable: Dayanara (`Dayanarablb`)

## Objetivo

Corregir una prueba intermitente de `InventoryPage` que selecciona el texto `Stock bajo` sin distinguir el KPI de las insignias de productos.

## Alcance

- Asegurar que la aserción del KPI identifique su tarjeta de forma semántica y no colisione con las insignias de las filas.
- Mantener una verificación separada de las insignias de stock bajo.
- No cambiar el comportamiento del inventario para acomodar el test.

## Criterios de aceptación

- [ ] La prueba identifica la métrica KPI de forma inequívoca y verifica las insignias por separado.
- [ ] La prueba pasa aislada y al ejecutar la suite frontend completa.
- [ ] `npm run test:coverage` termina sin fallos repetidos.

## Dependencias y rutas

- Dependencias: ninguna.
- Rutas: `frontend/src/features/inventory/pages/InventoryPage.test.tsx`.

## Evidencia de origen

La suite completa falló localmente con 341 pruebas aprobadas y una fallida por múltiples coincidencias de `Stock bajo`; al ejecutar la prueba aislada pasó. El Quality Gate del commit `22c47fb` en `develop` pasó.
