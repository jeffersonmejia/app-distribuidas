# Estrategia inicial de pruebas

## Responsabilidades

- Jefferson (`jeffersonmejia`) define el alcance, los criterios de aceptación y los umbrales.
- Jennifer (`Jntorres2001`) ejecuta las pruebas unitarias, de integración y de rendimiento con k6 sobre funcionalidades implementadas y con criterios acordados.
- La persona responsable de cada feature facilita datos de prueba representativos y corrige los defectos de su módulo.

Durante el scaffolding inicial este documento solo establece el plan. No se agregan pruebas, scripts k6 ni código de aplicación hasta que el trabajo de las features esté disponible.

## Niveles de prueba

- **Unitarias:** verifican reglas y unidades aisladas de cada feature.
- **Integración:** verifican persistencia, adaptadores y contratos entre componentes o features.
- **Rendimiento:** k6 mide los flujos críticos HTTP con datos representativos y un entorno identificado.
- **Aislamiento tenant:** se comprueba que un tenant no pueda consultar ni modificar datos de otro. Es un criterio funcional y de seguridad, independiente de los umbrales de rendimiento.

## E2E de frontend con Playwright — QA-006

- La primera fase automatiza tres recorridos de usuario: POS (venta y confirmación del cambio de existencias), Inventario (consulta de disponibilidad) y CRM (búsqueda/listado). No repite reglas de negocio, validación de persistencia, autorización/RLS ni migraciones que ya se prueban en backend; comprueba navegación, interacción visible y persistencia observable desde el browser.
- Jennifer ejecuta los E2E manualmente y en local al inicio, con backend local integrado y datos sintéticos aislados. Se autoriza un proveedor OIDC efímero local con Keycloak para emitir JWT de prueba y preparar una membresía de prueba. Nunca se usan producción, datos reales ni secretos permanentes.
- El login real de la aplicación queda fuera de esta fase mientras FRONT-003 mantenga el proveedor/login del frontend simulado. Los tests preparan el estado de autenticación con credenciales/token de prueba locales sin presentar el mock como una prueba del login real. No cambian ni inventan un contrato de autenticación.
- Las pruebas E2E se mantienen separadas de Vitest/Testing Library en `frontend/e2e/fixtures`, `frontend/e2e/specs/{auth,pos,inventory,crm}` y `frontend/e2e/support`. Vitest conserva las pruebas de componentes, páginas y servicios aislados; Playwright cubre los recorridos cross-page contra el backend.
- Inicialmente Playwright no corre en CI y no es gate de PR. Cuando el entorno y los flujos se estabilicen, Jefferson revisará si conviene añadirlo como check adicional no bloqueante; hacerlo requerido exige una decisión posterior explícita y criterios estables.
- Las pruebas usan un esquema/base aislada y datos deterministas. Credenciales y tokens solo por variables locales no versionadas; un reset nunca debe borrar ni modificar la base de desarrollo compartida.

## Flujos críticos para k6

1. **POS:** registrar una venta y comprobar el descuento de existencias.
2. **Inventario:** consultar un producto y su disponibilidad.
3. **CRM:** buscar o listar clientes dentro del tenant correspondiente.

Las pruebas deben usar credenciales y datos de prueba; no deben apuntar a producción. Los flujos que requieran autenticación se habilitarán cuando sus contratos estén implementados.

## Perfil y umbrales iniciales

- Ramp-up de 1 a 10 usuarios virtuales.
- Mantener 10 usuarios virtuales durante 5 minutos.
- Menos del 1% de solicitudes con error HTTP.
- Lecturas: p95 de duración menor a 500 ms.
- Escrituras, incluido el registro de venta: p95 menor a 1 s.

Los umbrales de lectura y escritura se medirán por separado, usando etiquetas de k6 por tipo de operación. Este perfil es la línea base inicial del entorno de desarrollo/pruebas; los resultados deben reportar el entorno, el tamaño de los datos y la versión evaluada. Si la carga real esperada cambia, Jefferson actualiza la línea base antes de que Jennifer ejecute la prueba correspondiente.

## Criterios de reporte

Cada ejecución de rendimiento debe indicar el flujo probado, entorno, datos utilizados, carga aplicada, duración, tasa de errores, p95 y resultado frente a los umbrales. Una ejecución que no respete los umbrales se reporta como fallida y se asigna a la persona responsable de la feature afectada.
