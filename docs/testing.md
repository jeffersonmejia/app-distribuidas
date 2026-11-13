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
