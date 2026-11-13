# ARC-002 — Estrategia de aislamiento multitenant

## Decisión y alcance

El MVP usa una única base PostgreSQL compartida y un esquema compartido. Cada fila de negocio propiedad de un cliente pertenece a exactamente un tenant mediante `tenant_id`. La autorización del backend es obligatoria; PostgreSQL RLS añade una segunda barrera para el acceso a filas.

Este documento define el diseño. En el scaffolding inicial no implementa autenticación, selección de tenant, `tenant_id` en entidades, políticas RLS ni pruebas de aplicación.

## Modelo de tenants, identidades y membresías

- **Tenant:** representa una organización cliente y tiene un identificador UUID global, estado y datos administrativos propios.
- **Usuario/identidad:** representa una cuenta global autenticable, con un identificador estable independiente de cualquier tenant. Las credenciales y datos de autenticación pertenecen a `identity`; los perfiles y reglas de negocio no se almacenan allí.
- **Membresía:** relaciona `user_id` con `tenant_id`, tiene estado (activa/revocada) y los permisos asignados a esa persona dentro de ese tenant. Una persona puede tener membresías en varios tenants; pertenecer a uno no concede acceso a los demás.
- **Datos de negocio:** pertenecen a un tenant. Las tablas de negocio incluyen `tenant_id NOT NULL`. Los catálogos verdaderamente globales son excepciones explícitas, de solo lectura para las features y documentadas por su propietaria.

El módulo `identity` autentica al actor y expone su identificador estable. El módulo `tenancy` administra tenants y membresías, valida que el actor pueda operar en el tenant solicitado y proporciona el contexto validado. Las features consumen ese contexto por `tenancy.api`; no consultan directamente las tablas internas de identidad o membresías.

## Resolución del contexto por solicitud

1. El backend autentica la solicitud y obtiene el actor desde una credencial validada. No acepta `actor_id` ni permisos declarados por el cliente como prueba de identidad.
2. La solicitud puede indicar el tenant que desea usar mediante el mecanismo de transporte que se acuerde para la API. Ese valor es solo un selector: no prueba autorización.
3. `tenancy` valida la membresía activa del actor y los permisos requeridos. Si no existe, está revocada o no autoriza la operación, el backend la rechaza antes de acceder a datos de negocio.
4. El backend crea un contexto inmutable por solicitud/transacción con `tenant_id` y `actor_id`. Todo caso de uso tenant-scoped lo recibe explícitamente.
5. La selección se aplica al ámbito de una transacción de base de datos y se elimina automáticamente al confirmar o revertirla. No se conserva contexto tenant en una conexión del pool entre solicitudes.

El selector HTTP (subdominio, ruta o header), el formato concreto de permisos y el mecanismo de autenticación quedan para sus tareas de diseño e implementación. Ninguno puede sustituir la validación de membresía en el backend.

## Reglas de persistencia

- Toda lectura, escritura, actualización y eliminación de datos tenant debe filtrar por el `tenant_id` validado; el filtro no se deriva de un valor libre enviado por el cliente.
- Las claves únicas de negocio son tenant-scoped, por ejemplo `UNIQUE (tenant_id, external_code)`, salvo que el requisito documente una unicidad global.
- Las referencias entre filas tenant-scoped deben conservar el mismo tenant. Se usan claves/constraints compuestas que incluyan `tenant_id` cuando una relación dependa de otra fila del mismo tenant; así la base de datos rechaza referencias cruzadas.
- `tenant_id` no se puede cambiar mediante una actualización normal. Una transferencia entre tenants, si alguna vez se permite, es una operación explícita, autorizada y auditada.
- Operaciones multi-fila de una feature usan límites transaccionales explícitos. Las restricciones de base de datos protegen invariantes y evitan escrituras parciales.
- Tareas en segundo plano, importaciones, reportes y mensajes/eventos deben transportar un `tenant_id` validado explícitamente. No pueden inferirlo de estado global o reutilizar contexto de otra solicitud.

## Política de RLS

Cuando se implemente RLS, se aplicará a todas las tablas tenant-scoped como defensa en profundidad:

- Habilitar RLS y usar políticas específicas por operación.
- Para `SELECT`, `UPDATE` y `DELETE`, la expresión `USING` limita las filas al tenant del contexto.
- Para `INSERT` y `UPDATE`, `WITH CHECK` exige que la fila nueva siga perteneciendo a ese tenant.
- Sin contexto tenant, la política debe fallar cerrada y no mostrar ni modificar filas.
- No crear políticas amplias que concedan acceso a todos los tenants por conveniencia. Excepciones de soporte/plataforma requieren rol separado, autorización explícita, auditoría y una decisión documentada.
- La aplicación se conecta con un rol de runtime sin superusuario, sin `BYPASSRLS` y distinto del propietario de tablas. Las migraciones usan credenciales separadas y restringidas. Se evalúa `FORCE ROW LEVEL SECURITY` en tablas tenant-scoped para que el propietario también esté sujeto a políticas cuando corresponda.
- Operaciones como backups y migraciones que deban leer todas las filas usan una identidad administrativa separada, controlada y no reutilizada por la aplicación.

Como mecanismo de propagación para una conexión compartida, la implementación puede fijar `app.tenant_id` de forma local a la transacción (`set_config(..., true)`) después de validar la membresía. RLS que dependa de un parámetro de sesión es una barrera contra errores de consultas ordinarias, no una defensa frente a ejecución arbitraria de SQL con el rol runtime: el servidor y su cuenta de base de datos siguen siendo componentes de confianza. Por eso se requieren consultas parametrizadas, privilegios mínimos y acceso a PostgreSQL solo desde servicios confiables.

## Responsabilidades por módulo

| Módulo/rol | Responsabilidad |
| --- | --- |
| `identity` | Autenticar al actor y publicar su identificador estable; no decidir acceso a datos de negocio de otros módulos. |
| `tenancy` | Ser propietario de tenant y membresías, validar la membresía activa y publicar el contexto tenant autorizado. |
| Cada feature | Ser propietaria de sus tablas y consultas; incluir `tenant_id`, respetar el contexto, declarar sus políticas RLS y restricciones en sus migraciones y no exponer datos internos a otras features. |
| DevOps/operación | Mantener secretos y roles separados para runtime, migraciones y respaldo; restringir la red/credenciales y habilitar auditoría operacional. |
| Jennifer (`Jntorres2001`) | Ejecutar las pruebas de aislamiento acordadas cuando exista implementación; no se le asigna el diseño del modelo o de los criterios. |
| Jefferson (`jeffersonmejia`) | Definir y aprobar alcance, permisos y excepciones de acceso entre tenants. |

## Criterios de aceptación para la implementación posterior

1. Una solicitud sin actor autenticado no llega a datos tenant-scoped.
2. Un actor sin membresía activa no puede leer ni modificar datos del tenant solicitado.
3. Datos creados por tenant A no son visibles ni modificables desde el contexto de tenant B.
4. Una escritura con `tenant_id` distinto al contexto se rechaza, incluso si el cliente manipula el payload.
5. Una referencia entre filas de tenants distintos es rechazada por una constraint.
6. Una consulta tenant-scoped sin contexto RLS falla cerrada.
7. Las pruebas usan el mismo rol de runtime que la aplicación y confirman que no es superusuario, propietario privilegiado ni `BYPASSRLS`.
8. El contexto no se filtra a otra solicitud cuando se reutiliza una conexión del pool, después de éxito o rollback.
9. Las rutas administrativas multi-tenant están separadas, autorizadas y auditadas.

## Referencias

- [Row Security Policies en PostgreSQL 16](https://www.postgresql.org/docs/16/ddl-rowsecurity.html): políticas, default-deny, roles que omiten RLS y `FORCE ROW LEVEL SECURITY`.
- [Funciones administrativas en PostgreSQL 16](https://www.postgresql.org/docs/16/functions-admin.html): `current_setting` y `set_config`; `is_local = true` limita el valor a la transacción.
