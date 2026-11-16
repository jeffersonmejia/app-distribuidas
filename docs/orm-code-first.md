# Política de persistencia — JPA/Hibernate Code First

## Estado y alcance

**Decisión obligatoria para el backend.** El modelo de objetos de cada feature se expresa con JPA/Hibernate y los cambios de esquema se entregan mediante migraciones Flyway revisadas. El backend ya incorpora Spring Data JPA, Flyway y el driver PostgreSQL. Este documento define las convenciones persistentes; las entidades, repositorios y migraciones de cada feature se implementan dentro de su tarea.

El backend declara Spring Data JPA, Flyway y el driver PostgreSQL en backend/pom.xml. Tenancy y CRM ya tienen entidades y migraciones. La adopción por otra feature requiere sus propios cambios de modelo, migración, validación y pruebas; no se debe describir como una capacidad aún no instalada.

## Decisiones obligatorias

- **Base de datos:** PostgreSQL 16, base y esquema compartidos, con propiedad de tablas por feature.
- **Code First y evolución:** las entidades JPA describen el mapeo del modelo; cada cambio persistente debe venir con una migración SQL Flyway revisada. La migración es la forma reproducible de cambiar una base existente; no se depende de que Hibernate altere el esquema automáticamente.
- **Validación del esquema:** usar `spring.jpa.hibernate.ddl-auto=validate` en los perfiles que conectan a una base persistente. No usar `update`, `create` ni `create-drop` para bases compartidas o persistentes. Una base efímera de pruebas podrá usar otra estrategia solo si su tarea lo define y nunca comparte datos.
- **Ubicación:** las entidades JPA, repositorios Spring Data y adaptadores de persistencia viven dentro de `features/<feature>/infrastructure/persistence/`. El dominio no importa JPA/Spring y las entidades JPA no se exponen en contratos de `api` ni en respuestas HTTP.
- **Migraciones:** se guardan bajo `backend/src/main/resources/db/migration/` y usan nombres descriptivos con versión Flyway única, por ejemplo `V20261112_001__crm_create_customers.sql`. Cada cambio de entidad y su migración correspondiente se revisan juntos. Los autores coordinan las versiones para evitar colisiones entre ramas de features.
- **Identificadores:** toda entidad persistente usa `UUID` como identificador primario. Las claves naturales y reglas de unicidad se expresan además como constraints; el UUID nunca sustituye autorización.
- **Aislamiento:** toda tabla tenant-scoped incluye `tenant_id UUID NOT NULL`. Las constraints de unicidad y relaciones respetan el tenant, según `docs/multitenancy.md`. No se crean relaciones JPA entre internals de features; la integración usa IDs y contratos públicos.
- **Auditoría:** los registros de negocio persistentes usan `created_at`, `updated_at`, `created_by` y `updated_by` según corresponda. Fechas se representan como instantes con zona horaria y se manejan en UTC. Los UUID de actor son valores de auditoría, no claves foráneas a tablas internas de `identity`.
- **Borrado lógico:** los registros de negocio eliminables usan `deleted_at`; las consultas ordinarias excluyen registros borrados. Constraints de unicidad deben definir explícitamente si aplican a todos los registros o solo a activos; si se requiere unicidad de activos, se usa una constraint/índice parcial de PostgreSQL. Los registros contables o legalmente inmutables se anulan/corrigen con estado o movimiento compensatorio; no se borran físicamente.
- **Tipos:** enums se guardan como texto, nunca como ordinal; dinero usa `BigDecimal`/`NUMERIC` con precisión y escala definidas por feature; no usar `float`/`double` para importes.
- **Relaciones y cascadas:** no cargar relaciones perezosas implícitamente en respuestas ni cruzar límites de feature. Cascada de borrado no es automática; solo se define para componentes propiedad del mismo agregado y con una regla de retención compatible.

## Flujo de cambio

1. El responsable de la feature define el cambio de modelo y confirma su tenant scope, constraints, índices y retención con Jefferson.
2. Modifica las entidades JPA y crea una migración Flyway incremental, segura para datos existentes y con límites transaccionales explícitos.
3. Revisa la compatibilidad de la migración con código desplegado y datos anteriores; nunca reescribe una migración ya aplicada en un entorno compartido.
4. Verifica que Flyway pueda construir una base vacía, aplicar la migración sobre la versión previa y que Hibernate valide el esquema resultante.
5. En cambios tenant-scoped, añade cuando la implementación esté autorizada las políticas RLS y verificaciones de aislamiento de `docs/multitenancy.md`.

## Decisiones que se concretan por feature

La política común no inventa reglas de negocio. Cada feature debe definir antes de implementar: campos obligatorios, precisión monetaria, claves naturales, estados, reglas de borrado/retención, índices basados en consultas reales y relaciones dentro de su agregado. Una decisión no definida se consulta con Jefferson; no se reemplaza con un valor supuesto.

## Referencias

- [Guía de Hibernate ORM 6.6 — generación de esquema](https://docs.hibernate.org/orm/6.6/userguide/html_single/#schema-generation): generación automática resulta útil para prototipos/pruebas; para producción la guía recomienda migraciones incrementales.
- [Inicialización de bases de datos con Spring Boot](https://docs.spring.io/spring-boot/how-to/data-initialization.html): Spring Boot integra Flyway para ejecutar migraciones.
- [Constraints de PostgreSQL 16](https://www.postgresql.org/docs/16/ddl-constraints.html): claves primarias, únicas y foráneas, incluidas restricciones compuestas.
