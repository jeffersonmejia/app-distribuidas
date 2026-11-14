# PROJ-001 — Gestión básica de proyectos

Issue: [#9](https://github.com/jeffersonmejia/app-distribuidas/issues/9) · Responsable: Esteban (`EMLarco`)

## Lógica confirmada

- La feature projects es dueña de proyectos, tareas, estados, sus tablas y API; no accede a internals de otras features.
- Proyecto y sus tareas pertenecen a un único tenant validado. Las relaciones y claves únicas incluyen tenant cuando corresponde.
- Listas aplican filtro y paginación en base de datos, tamaño máximo 5 y orden estable.
- Persistencia usa UUID, `tenant_id NOT NULL`, constraints, auditoría, borrado lógico cuando se defina, JPA y Flyway.

## Alcance de esta tarea

Definir el modelo de proyecto y tarea, los casos de uso y los contratos de creación, lectura y actualización básica. El código no debe elegir por intuición estados, permisos, prioridad, fecha de vencimiento, subtareas ni reglas de cierre.

## Bloqueo: decisiones que deben aprobarse antes de persistir

Campos obligatorios de proyecto/tarea, catálogo y transiciones de estados, permisos por operación, reglas de borrado/retención y relación de tareas entre proyectos. Responsable de definirlos: Jefferson (`jeffersonmejia`). La lógica de tenancy y límites de módulo sí queda fijada por los documentos base.
