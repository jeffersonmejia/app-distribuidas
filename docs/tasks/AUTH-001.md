# AUTH-001 — Acordar autenticación y permisos del MVP

Issue: [#26](https://github.com/jeffersonmejia/app-distribuidas/issues/26) · Responsable: @jeffersonmejia · Área: Multitenancy

## Objetivo

Contrato JWT bearer con actor UUID, selector tenant no confiable y permisos explícitos por membresía.

## Instrucciones

1. Revisa el alcance aprobado en la Issue y las referencias del repositorio antes de modificar archivos.
2. Implementa únicamente lo necesario para cumplir los criterios de aceptación de esta tarea.
3. Mantén los cambios dentro de las rutas indicadas y coordina cualquier cambio de alcance antes de ejecutarlo.
4. Actualiza la documentación relacionada y deja evidencia verificable en la Issue o en el entregable correspondiente.

## Criterios de aceptación

- Documentar mecanismo y ciclo de credenciales.
- Definir que no hay roles implícitos, permisos explícitos y selector tenant como dato no confiable.
- Especificar rechazos sin actor, membresía o permiso.
- No aceptar actor_id ni permisos del cliente como autorización.

## Dependencias

- ARC-002

## Rutas previstas

- `docs/multitenancy.md`
- `docs/autenticacion.md`

## Seguimiento

El estado de ejecución y la evidencia de cierre se registran en la Issue y en GitHub Projects. Este instructivo describe el alcance aprobado; no reemplaza la verificación de los entregables.
