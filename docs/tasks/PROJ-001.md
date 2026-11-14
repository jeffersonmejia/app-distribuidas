# PROJ-001 — Gestión de proyectos y tareas

Issue: [#9](https://github.com/jeffersonmejia/app-distribuidas/issues/9) · Responsable: Esteban (`EMLarco`)

## Reglas aprobadas

- Proyecto: el nombre es obligatorio; descripción y fechas son opcionales.
- Tarea: el título es obligatorio; descripción, responsable, prioridad y fecha de vencimiento son opcionales. Cada tarea pertenece a un solo proyecto.
- Prioridades opcionales: Alta, Media y Baja.
- Estados: Pendiente, En progreso, Bloqueada y Completada.
- Transiciones: Pendiente puede pasar a En progreso o Bloqueada; En progreso puede volver a Pendiente, pasar a Bloqueada o Completada; Bloqueada vuelve al estado que tenía antes del bloqueo; Completada puede reabrirse como En progreso.
- Todas las operaciones requieren permiso explícito por tenant y operación (`leer`, `crear`, `editar`, `eliminar`); no se conceden permisos por defecto ni se infieren roles.
- El borrado es lógico y restaurable. No hay purga automática; la eliminación permanente requiere acción manual con permiso explícito.

## Lógica y límites

- Projects es dueño de sus proyectos, tareas, estados, casos de uso y persistencia; no accede a internals de otras features.
- Proyecto y tarea pertenecen al tenant validado. Cada operación valida actor, membresía activa y permiso en backend.
- Las listas filtran y paginan en base de datos con máximo 5 elementos y orden estable.
- Persistencia con UUID, `tenant_id NOT NULL`, constraints tenant-scoped, auditoría, borrado lógico, JPA, migraciones Flyway y RLS fail-closed.
- Aplicar ACID en operaciones de creación, edición, borrado y restauración; las restricciones de base de datos protegen invariantes tenant-scoped.

## Entrega

- Fecha objetivo de esta tarea: 19 de noviembre de 2026.
- La lógica de tenancy, permisos y aislamiento se toma de `docs/multitenancy.md`; no se implementan roles implícitos.
