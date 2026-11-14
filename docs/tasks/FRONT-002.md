# FRONT-002 — Layout y navegación principal

Issue: [#7](https://github.com/jeffersonmejia/app-distribuidas/issues/7) · Responsable: Dayanara (`Dayanarablb`)

## Lógica

- Construir el contenedor visual común y navegación por módulos posteriores a FRONT-001.
- Preparar rutas base para CRM, inventario/POS, proyectos, marketing y contabilidad conforme a `docs/arquitectura.md`.
- Las rutas no simulan operaciones de negocio ni inventan datos; mientras una pantalla no esté implementada, mostrar el estado vacío/no disponible acordado.
- El layout responde a tamaños pequeños y amplios, conserva foco visible y usa componentes/tokens de FRONT-001.

## Alcance

Layout, navegación y rutas base. No implementar CRUD ni duplicar reglas de autorización. La autorización real sigue en backend y las pantallas de dominio pertenecen a FRONT-003/004/005.

## Dependencia

FRONT-001. La tarea debe permanecer bloqueada hasta que estén listos sus tokens y componentes base.
