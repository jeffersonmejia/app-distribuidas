# ERP + CRM multitenant

ERP + CRM multitenant con backend Java/Spring Boot organizado como monolito modular y frontend React/TypeScript organizado por features. La base de datos acordada es PostgreSQL compartido con `tenant_id`.

El alcance de esta entrega es preparar el MVP inicial, no completar todo el ERP/CRM: incluye la base técnica multitenant y modular, la estructura de los módulos, el frontend inicial y los servicios locales de desarrollo. La fecha máxima objetivo para esta etapa es el domingo 15 de noviembre de 2026; la lógica de negocio completa se implementará después como trabajo de cada módulo.

## Responsabilidades del equipo

| Desarrollador | Usuario de GitHub | Responsabilidad |
| --- | --- | --- |
| Jefferson | `jeffersonmejia` | Backend y DevOps; define arquitectura y alcance técnico. |
| Esteban | `EMLarco` | Backend; ejecuta las tareas backend acordadas. |
| Sahid | `Sahid-B` | Backend; ejecuta las tareas backend acordadas. |
| Jennifer | `Jntorres2001` | Testing: pruebas unitarias, de integración y de rendimiento con k6, cuando el alcance esté definido y exista funcionalidad que probar. |
| Dayanara | `Dayanarablb` | Frontend. |
| Bruce | `BruceRodri` | Backend; ejecuta las tareas backend acordadas por feature. |

Las decisiones de alcance y diseño se asignan a Jefferson. Las demás personas ejecutan tareas con alcance y criterios de aceptación definidos. Durante el scaffolding inicial no se implementan pruebas ni código de aplicación; las tareas de testing se ejecutan cuando ese trabajo esté autorizado y disponible.

## Directorios vacíos

La estructura preparada para las features conserva sus directorios vacíos requeridos con archivos `.gitkeep`. Estos marcadores no contienen código y se retiran cuando el directorio recibe su primer archivo real.
