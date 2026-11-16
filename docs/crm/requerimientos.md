# CRM-001 — Requerimientos de gestión inicial de clientes

| Campo | Valor |
| --- | --- |
| Issue | [#4 — CRM-001 Implementar gestión inicial de clientes](https://github.com/jeffersonmejia/app-distribuidas/issues/4) |
| Responsable | Bruce (`BruceRodri`) |
| Área | CRM |
| Estado del contrato | Decisiones de alcance aprobadas por Jefferson |
| Paquete | `backend/src/main/java/com/erp/features/crm/` |

## 1. Propósito

Implementar el registro y la consulta inicial de clientes dentro de la feature `crm`, con persistencia, operaciones básicas, autorización por tenant y pruebas unitarias. Este documento es el contrato de implementación de CRM-001. Si una regla no aparece aquí ni en las políticas referenciadas, Bruce debe consultarla con Jefferson antes de decidirla.

## 2. Alcance

CRM-001 incluye:

- Clientes que son personas naturales. No incluye empresas, RUC ni contactos separados.
- Alta, consulta, búsqueda, actualización, activación/desactivación, archivo lógico y restauración de clientes.
- Un contrato interno de lectura para que otras features consulten los clientes de forma autorizada.
- Persistencia PostgreSQL con migración Flyway, aislamiento tenant, auditoría y pruebas unitarias de las reglas.

Fuera de alcance:

- Clientes persona jurídica, RUC, múltiples documentos, contactos adicionales, direcciones, notas, etiquetas o archivos adjuntos.
- Importación/exportación masiva, integración con registros gubernamentales, validación de identidad en línea, deduplicación asistida o fusión de clientes.
- Envío de campañas, mensajes o correos; la feature Marketing define esos flujos.
- Interfaz frontend, reportes y pruebas de rendimiento de CRM-001.

## 3. Modelo de cliente

Un cliente pertenece a un único tenant. La feature es dueña de su modelo, reglas, consultas, tabla y migraciones.

| Campo | Tipo conceptual | Regla |
| --- | --- | --- |
| `id` | UUID | Identificador generado por el backend; inmutable. |
| `tenant_id` | UUID | Obligatorio; se obtiene únicamente del `TenantContext` validado. No se recibe como dato de creación o actualización. |
| `full_name` | texto | Obligatorio, no vacío después de quitar espacios al inicio y al final. Conserva nombres y apellidos en un solo campo. |
| `cedula` | texto de hasta 10 dígitos | Opcional. Si se proporciona, debe tener exactamente 10 dígitos y pasar la validación del dígito verificador ecuatoriano. Se almacena como texto para conservar ceros iniciales. |
| `email` | texto | Opcional. Si se proporciona, debe tener formato de correo válido, se recortan espacios y se normaliza a minúsculas para comparar y almacenar. |
| `phone` | texto | Opcional; se recortan espacios. No es clave única ni se usa como identificador del cliente. |
| `status` | enum textual | `ACTIVE` o `INACTIVE`; al crear se asigna `ACTIVE`. |
| `created_at`, `updated_at` | instante UTC | Auditoría de creación y última modificación. |
| `created_by`, `updated_by` | UUID | Actor validado que creó o modificó el registro. No son claves foráneas a tablas internas de `identity`. |
| `deleted_at` | instante UTC nullable | Nulo mientras el cliente no esté archivado; se establece al archivar y se limpia al restaurar. |

`status` y archivo son conceptos separados. Un cliente inactivo sigue existiendo y puede reactivarse; un cliente archivado queda fuera de las consultas ordinarias hasta ser restaurado.

## 4. Reglas de negocio y validación

1. `full_name` es el único campo de negocio obligatorio. Los campos opcionales vacíos después de recortarlos se guardan como `NULL`.
2. La cédula, si existe, debe contener solo 10 dígitos ASCII y cumplir el algoritmo ecuatoriano del dígito verificador. No se consulta ningún servicio externo y la validación no afirma que el documento haya sido emitido por una autoridad.
3. La cédula no puede repetirse dentro del mismo tenant. Se compara su valor normalizado y la restricción incluye clientes activos, inactivos y archivados.
4. El email no puede repetirse dentro del mismo tenant, aunque difiera solo en mayúsculas/minúsculas. La regla también incluye clientes archivados. El mismo email puede existir en tenants distintos.
5. Cédula y email son opcionales; por ello, varios clientes pueden no tenerlos. Los valores `NULL` no chocan entre sí.
6. Al crear, el estado es `ACTIVE`. Solo las operaciones autorizadas de cambio de estado pueden alternar entre `ACTIVE` e `INACTIVE`.
7. Archivar es borrado lógico: conserva la fila y sus datos, completa `deleted_at` y actualiza auditoría. No se borra físicamente ni existe purga automática.
8. Restaurar limpia `deleted_at`, actualiza auditoría y conserva el estado activo/inactivo que tenía el cliente. Si sus identificadores chocan con otro registro, la restauración falla con `409` y no modifica datos.
9. Las operaciones de actualización no pueden cambiar `id`, `tenant_id`, `created_at` ni `created_by`. El cambio de estado se realiza por su operación explícita.
10. Cada búsqueda y escritura se ejecuta en una transacción con el `TenantContext` validado. No se aceptan `tenant_id`, `actor_id` ni permisos enviados por el cliente como prueba de autorización.

## 5. Operaciones y permisos

| Operación | Permiso requerido | Resultado |
| --- | --- | --- |
| Crear cliente | `crm:customers:create` | Crea cliente activo y devuelve su representación pública. |
| Listar/buscar clientes | `crm:customers:read` | Devuelve solo clientes no archivados del tenant activo. |
| Consultar cliente por ID | `crm:customers:read` | Devuelve el cliente no archivado del tenant activo. |
| Actualizar datos de cliente | `crm:customers:update` | Actualiza nombre y campos opcionales permitidos. |
| Activar/desactivar cliente | `crm:customers:update` | Cambia `status`; no archiva ni restaura. |
| Archivar cliente | `crm:customers:archive` | Aplica borrado lógico. |
| Restaurar cliente | `crm:customers:archive` | Restaura un registro archivado del mismo tenant. |

Cada permiso es un código explícito consultado en la membresía activa mediante `TenantAccess.execute`. Los roles, claims JWT y el selector `X-Tenant-ID` no sustituyen esa comprobación. Una membresía inactiva, revocada o sin el permiso requerido debe denegar la operación.

## 6. Contrato HTTP inicial

Usar el prefijo `/api/v1/crm/customers` y los DTO de `api`; nunca serializar ni devolver la entidad JPA.

| Método y ruta | Permiso | Comportamiento |
| --- | --- | --- |
| `POST /api/v1/crm/customers` | `crm:customers:create` | Crea un cliente. Responde `201 Created` y representación del cliente. |
| `GET /api/v1/crm/customers` | `crm:customers:read` | Lista/busca clientes no archivados del tenant. |
| `GET /api/v1/crm/customers/{id}` | `crm:customers:read` | Consulta un cliente no archivado por UUID. |
| `PATCH /api/v1/crm/customers/{id}` | `crm:customers:update` | Modifica `full_name`, `cedula`, `email` o `phone`. `null` limpia campos opcionales. |
| `PATCH /api/v1/crm/customers/{id}/status` | `crm:customers:update` | Cambia el estado a `ACTIVE` o `INACTIVE`. |
| `DELETE /api/v1/crm/customers/{id}` | `crm:customers:archive` | Archiva lógicamente; nunca ejecuta `DELETE` físico sobre la fila. |
| `POST /api/v1/crm/customers/{id}/restore` | `crm:customers:archive` | Restaura un cliente archivado. |

La lista acepta `search`, `status`, `page` y `size`. `search` busca por nombre, cédula o email; `status` acepta `ACTIVE` o `INACTIVE`. `page` comienza en cero. `size` por defecto es 5 y nunca puede superar 5, según la regla global de paginación. La consulta y el ordenamiento se hacen en PostgreSQL; usar un orden estable, por ejemplo nombre y luego UUID. No se carga toda la tabla para filtrar o paginar en memoria.

La respuesta de lista incluye `items`, `page`, `size` y `hasNext`. Las respuestas individuales incluyen `id`, `fullName`, `cedula`, `email`, `phone`, `status`, `createdAt` y `updatedAt`; nunca exponen `tenant_id`, datos internos de membresía ni credenciales.

## 7. Contrato público para otras features

`crm.api` puede publicar contratos de lectura estables, sin JPA ni dependencias de internals. Para Marketing, exponer una operación de consulta de clientes activos por sus UUIDs bajo el `TenantContext` autorizado. La respuesta contiene solo `id`, `fullName`, `email` y `phone`, que son necesarios para reconocer clientes y preparar sus contactos; no expone cédula ni auditoría. No entregar registros archivados o inactivos en la búsqueda de clientes activos.

El contrato público valida `crm:customers:read` con tenancy y limita la consulta al tenant del contexto. Marketing no consulta tablas ni repositorios de CRM directamente. Si otro flujo necesita más datos, se acuerda el contrato antes de implementarlo.

## 8. Persistencia y aislamiento

- Tabla propiedad de CRM, por ejemplo `crm_customer`, en PostgreSQL 16.
- PK UUID y columna `tenant_id UUID NOT NULL`.
- Restricción única tenant-scoped para cédula y para email normalizado. Ambas incluyen todos los registros, también los archivados; la unicidad de email ignora mayúsculas/minúsculas. PostgreSQL debe permitir múltiples `NULL` en esos campos.
- Las constraints son la última defensa contra duplicados simultáneos. El caso de carrera entre solicitudes se traduce a un error de dominio/API `409`, sin filtrar datos de otro cliente o tenant.
- Migración Flyway incremental en `backend/src/main/resources/db/migration/`, con versión única coordinada con Jefferson. No modificar migraciones que ya se hayan aplicado en un entorno compartido.
- Habilitar políticas RLS para la tabla tenant-scoped conforme a `docs/multitenancy.md`: `USING` para lectura/actualización/borrado lógico y `WITH CHECK` para inserción/actualización. Sin contexto tenant, el acceso debe fallar cerrado.
- Usar el rol de runtime y contexto transaccional descritos por las políticas existentes. No crear un segundo mecanismo local de tenant ni fijar contexto a nivel de sesión.
- Aplicar `created_at`, `updated_at`, `created_by`, `updated_by` y `deleted_at` de acuerdo con `docs/orm-code-first.md`.
- No agregar índices de búsqueda por intuición; justificar los índices adicionales con las consultas de este contrato y su plan de ejecución.

## 9. Organización de la feature

Respetar Feature-First y arquitectura hexagonal. La implementación se limita a:

```text
backend/src/main/java/com/erp/features/crm/
├── api/                         # DTOs y contratos públicos
├── application/                 # casos de uso y puertos
├── domain/                      # Customer, estados y reglas puras
└── infrastructure/
    └── persistence/             # entidades JPA, repositorio y adaptadores
```

El adaptador HTTP y la migración Flyway se agregan solo donde correspondan a la estructura acordada del repositorio. El dominio no importa Spring/JPA; ninguna otra feature accede a paquetes internos de CRM.

Casos de uso mínimos: `CreateCustomer`, `ListCustomers`, `GetCustomer`, `UpdateCustomer`, `ChangeCustomerStatus`, `ArchiveCustomer` y `RestoreCustomer`. Publicar además el contrato de lectura de CRM para Marketing descrito arriba.

## 10. Errores y respuestas

| Situación | HTTP | Código de error esperado |
| --- | --- | --- |
| Token ausente o inválido | 401 | Manejo estándar de autenticación. |
| Sin membresía activa o sin permiso | 403 | Manejo estándar de autorización; no acceder a CRM. |
| Datos requeridos/formato inválido | 400 | `INVALID_CUSTOMER_DATA`. |
| Cliente inexistente, archivado o de otro tenant | 404 | `CUSTOMER_NOT_FOUND`; no revelar si existe en otro tenant. |
| Cédula duplicada en el tenant | 409 | `CUSTOMER_CEDULA_ALREADY_EXISTS`. |
| Email duplicado en el tenant | 409 | `CUSTOMER_EMAIL_ALREADY_EXISTS`. |
| Restauración que viola unicidad | 409 | Código de conflicto correspondiente a cédula o email. |

Los errores no incluyen SQL, stack traces, valores de otros tenants ni datos personales innecesarios. No escribir cédulas, emails o teléfonos completos en logs.

## 11. Pruebas requeridas

Agregar pruebas unitarias para el dominio y los casos de uso:

- Creación válida, nombre requerido, campos opcionales ausentes, espacios recortados y estado inicial `ACTIVE`.
- Cédula de 10 dígitos válida, longitud incorrecta, caracteres no numéricos y dígito verificador incorrecto.
- Email válido, inválido, normalización a minúsculas y tratamiento de espacios.
- Rechazo de cédula y email repetidos en el mismo tenant; permitir el mismo valor en tenants distintos.
- Cédula/email de un cliente archivado continúan reservados y bloquean un alta duplicada.
- Actualización no cambia UUID, tenant ni campos de creación; `null` limpia solo campos opcionales.
- Cambios `ACTIVE`/`INACTIVE`, archivo lógico y restauración conservan el estado, actualizan auditoría y nunca borran físicamente.
- Listado filtra tenant, excluye archivados, aplica búsqueda/estado y limita `size` a 5 con orden estable.
- Cada caso de uso requiere el permiso de la tabla; membresía ausente/inactiva o permiso ausente deniega.
- Un ID de otro tenant se comporta como no encontrado y nunca permite leer, modificar, archivar o restaurar el registro.
- El contrato para Marketing devuelve solo campos aprobados, únicamente clientes activos del tenant autorizado.

Agregar pruebas de persistencia/integración para las constraints de unicidad incluyendo archivados, el mapeo de errores `409`, la migración Flyway y el aislamiento RLS. Las pruebas de unidad no sustituyen la validación tenant en PostgreSQL.

## 12. Criterios de aceptación de CRM-001

- [ ] El modelo y los casos de uso siguen esta especificación y los límites de `docs/arquitectura.md`.
- [ ] Se crean, consultan, buscan, actualizan, activan/desactivan, archivan y restauran clientes según las reglas de este documento.
- [ ] La cédula opcional se valida con 10 dígitos y dígito verificador ecuatoriano; email opcional se valida y normaliza.
- [ ] Cédula y email son únicos por tenant incluso en registros archivados; las constraints PostgreSQL protegen también solicitudes simultáneas.
- [ ] Todas las operaciones exigen el permiso explícito correspondiente y contexto autenticado/tenant validado.
- [ ] No hay lecturas o escrituras cruzadas entre tenants; las políticas RLS y constraints tenant-scoped están en la migración.
- [ ] El borrado es lógico, no hay purga automática y las consultas ordinarias excluyen archivados.
- [ ] Marketing consume el contrato público de CRM, no entidades, repositorios ni tablas internas.
- [ ] Las pruebas unitarias cubren las reglas indicadas y las pruebas de persistencia comprueban migración, constraints y aislamiento.
- [ ] Los checks de CI pasan, incluida cobertura diferencial mínima del 80% para líneas Java cambiadas.

## 13. Políticas de referencia

- [`docs/arquitectura.md`](../arquitectura.md): límites de módulos y contrato CRM–Marketing.
- [`docs/multitenancy.md`](../multitenancy.md): JWT, selector de tenant, membresía, permisos, contexto y RLS.
- [`docs/autenticacion.md`](../autenticacion.md): autenticación Bearer JWT.
- [`docs/orm-code-first.md`](../orm-code-first.md): JPA, Flyway, UUID, auditoría y borrado lógico.
- [`docs/testing.md`](../testing.md): responsabilidades, pruebas y expectativas del flujo CRM.
