# AUTH-002 — Implementar identidad y autorización del backend

Issue: [#27](https://github.com/jeffersonmejia/app-distribuidas/issues/27) · Responsable: @jeffersonmejia · Área: Multitenancy

## Objetivo

Implementar identidad autenticada y protección stateless del backend según el contrato JWT.

## Instrucciones

1. Revisa el alcance aprobado en la Issue y las referencias del repositorio antes de modificar archivos.
2. Implementa únicamente lo necesario para cumplir los criterios de aceptación de esta tarea.
3. Mantén los cambios dentro de las rutas indicadas y coordina cualquier cambio de alcance antes de ejecutarlo.
4. Actualiza la documentación relacionada y deja evidencia verificable en la Issue o en el entregable correspondiente.

## Criterios de aceptación

- El actor proviene de credenciales validadas y de `sub` UUID.
- Las rutas privadas rechazan solicitudes no autenticadas; tenancy valida membresía/permisos antes de datos tenant-scoped.
- Credenciales y errores no aparecen en logs ni respuestas.
- Pruebas cubren acceso permitido, token ausente/inválido y validación de audiencia/actor.

## Dependencias

- AUTH-001

## Rutas previstas

- `backend/pom.xml`
- `backend/src/main/java/com/erp/features/identity/`
- `backend/src/test/java/com/erp/features/identity/`

## Seguimiento

El estado de ejecución y la evidencia de cierre se registran en la Issue y en GitHub Projects. Este instructivo describe el alcance aprobado; no reemplaza la verificación de los entregables.
