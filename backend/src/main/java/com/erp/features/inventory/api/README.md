# INV-001 — Diseño inicial del catálogo y existencias

## Alcance y estado de la entrega

Responsable: Sahid (`Sahid-B`). Tarea: [INV-001, issue #5](https://github.com/jeffersonmejia/app-distribuidas/issues/5).

Este documento conserva el diseño de INV-001. El núcleo ejecutable de movimientos,
su contrato `InventoryMovements`, decisiones concretadas, permisos y pruebas se
documentan en [INV-003](../../../../../../../../../docs/tasks/INV-003.md).

Este documento desarrolla el diseño exigido por [la especificación de INV-001](../../../../../../../../../docs/tasks/INV-001.md). La especificación dispone que, hasta acordar campos de producto, identificador comercial, unidades, reglas de alta/edición, existencia inicial y propiedad de precio/costo, la entrega sea el diseño con esas decisiones explícitas, sin codificarlas como defaults.

Por tanto, esta entrega no fija un esquema, tipos de cantidad, validaciones comerciales ni contratos Java que dependan de esas decisiones. No implementa controladores, persistencia o movimientos y no afirma que existan casos de uso ejecutables ni pruebas unitarias aprobadas.

Las secciones **obligatorias** derivan de las políticas del repositorio. Los casos de uso **propuestos** son material para revisión de Jefferson; sus nombres no representan clases o endpoints ya existentes.

## Fuentes y dependencias

- [Arquitectura y límites de módulos](../../../../../../../../../docs/arquitectura.md).
- [Aislamiento multitenant](../../../../../../../../../docs/multitenancy.md).
- [Persistencia Code First](../../../../../../../../../docs/orm-code-first.md).
- [Contrato de movimientos INV-002](../../../../../../../../../docs/tasks/INV-002.md).
- [Implementación de movimientos INV-003](../../../../../../../../../docs/tasks/INV-003.md).
- [Estrategia de pruebas](../../../../../../../../../docs/testing.md).

TEN-001 proporciona `tenancy.api.TenantAccess`, `TenantContext` y `TenantOperation`, que se reutilizarán al implementar el catálogo. Las definiciones comerciales pendientes se registran al final de este documento y se coordinan con INV-002 antes de fijar contratos ejecutables.

## Modelo conceptual

### Producto — obligatorio

Producto es un registro de negocio propiedad de Inventory y de un único tenant. Su identidad persistente será UUID y conservará `tenant_id NOT NULL`. El UUID técnico no sustituye el identificador comercial ni concede autorización.

Los campos comerciales se definirán en Q-1/Q-2. Este diseño no presupone SKU, nombre obligatorio, categoría, precio, moneda, costo o un estado de producto. Tampoco establece longitud, formato, unicidad o valores por defecto de esos campos.

### Existencias — obligatorio y límites pendientes

Inventory es propietario de las cantidades asociadas a sus productos. Toda referencia persistente desde existencias a un producto debe conservar el tenant mediante una relación/constraint que incluya `tenant_id`; no basta con comprobarlo en la UI.

La cardinalidad y clave del saldo no están fijadas. Dependen de si las existencias se registran solo por producto o también por almacén, ubicación u otra dimensión (Q-4). El diseño no crea automáticamente un saldo cero al dar de alta un producto ni interpreta un saldo ausente como cero (Q-5).

La representación de cantidad, su unidad y sus operaciones válidas se acuerdan con INV-002 (Q-3). Existencia registrada y disponibilidad para vender no se consideran equivalentes hasta que se defina el efecto de las reservas. Las entradas, salidas y reservas pertenecen a INV-003 después de cerrar INV-002; editar datos de catálogo no es una vía alternativa para modificar cantidades.

### Relación entre catálogo y existencias

```text
Tenant validado
  └── Inventory
       ├── Producto (UUID; campos comerciales pendientes)
       └── Existencias (referencia al producto en el mismo tenant;
                       unidad y dimensiones pendientes)
```

No hay entidades JPA compartidas con POS, tenancy o identity. Los identificadores de actor usados para auditoría son valores; no autorizan consultar tablas internas de identity.

## Contexto y autorización obligatorios

1. La frontera de entrada recibe el selector del tenant y autentica al actor mediante la infraestructura existente. El selector `X-Tenant-ID` no es prueba de autorización.
2. La aplicación solicita autorización a `TenantAccess.execute(TenantId, requiredPermission, TenantOperation<T>)`. El permiso debe ser el código acordado para la operación, no un claim o un texto elegido por el cliente. Los códigos de Inventory quedan pendientes en Q-8.
3. Solo dentro del callback autorizado se invoca el caso de uso con el `TenantContext` proporcionado por tenancy. No se construye un contexto local a partir de IDs libres ni se utiliza estado global.
4. Los puertos de persistencia reciben explícitamente el tenant de ese contexto. Toda lectura/escritura se filtra por él, también las consultas por ID y los filtros de búsqueda.
5. Los identificadores de producto fuera del tenant se comportan como inexistentes. La respuesta no revela si existen en otro tenant.
6. La implementación de tenancy valida membresía, permisos y estado y establece el contexto PostgreSQL local a la transacción. Inventory debe mantener sus propias constraints y políticas RLS fail-closed; no omitirlas para resolver errores.

El contexto existente es `com.erp.features.tenancy.api.TenantContext`; no se crea un tipo alternativo ni se copia el actor desde el payload. La firma conceptual de cada caso de uso interno empieza con ese contexto. La autorización efectiva se ejecuta mediante `TenantAccess`, no mediante la mera existencia de un record de contexto.

## Casos de uso propuestos para acordar

| Caso conceptual | Entrada además del contexto autorizado | Respuesta conceptual | Pendientes que impiden fijar su contrato ejecutable |
| --- | --- | --- | --- |
| Alta de producto | Datos comerciales por definir | Vista del producto registrado con ID de Inventory | Q-1, Q-2, Q-5, Q-6, Q-8. No se inicializa una cantidad supuesta. |
| Consulta de producto por ID | UUID de producto | Vista pública del producto o no encontrado | Q-1 y Q-8; la vista no expone una entidad JPA. |
| Listado de catálogo | Página, tamaño y filtros/orden admitidos | Página de vistas públicas | Q-1, Q-7, Q-8. La consulta filtra por tenant en PostgreSQL. |
| Edición de producto | UUID y campos permitidos por definir | Vista actualizada o error acordado | Q-1, Q-2, Q-6, Q-8; no incluye edición de saldo. |
| Consulta de existencias de producto | UUID y dimensiones que se acuerden | Cantidad/unidad y dimensiones acordadas | Q-3, Q-4, Q-5, Q-8, Q-10. No equivale todavía a disponibilidad. |

Estos son candidatos mínimos para revisión, no una ampliación aprobada. Alta/edición/consulta no suponen que borrar, desactivar, importar, ajustar saldos o establecer precios forme parte del alcance.

### Secuencia de los casos de uso

| Caso propuesto | Pasos del caso autorizado | Resultado sin efectos parciales |
| --- | --- | --- |
| Alta | Validar los campos acordados; comprobar la regla comercial de unicidad cuando se defina; generar UUID; persistir producto y auditoría. Si Q-5 exige existencias iniciales, incluirlas en la misma transacción. | Vista del producto confirmado. Si falla una validación o escritura, no queda un alta parcial. |
| Consulta por ID | Buscar por tenant validado e ID; aplicar la política de registros visibles; transformar el resultado a vista pública. | Vista o no encontrado, sin distinguir recursos de otro tenant. |
| Listado | Validar página/tamaño/filtros acordados; ejecutar consulta tenant-scoped con orden estable y paginación en PostgreSQL; proyectar la página. | Como máximo cinco productos. No se filtra ni pagina un conjunto completo en memoria. |
| Edición | Buscar por tenant e ID; validar únicamente los campos editables acordados; preservar identidad y tenant; guardar cambios y auditoría en una transacción. | Vista actualizada; no modifica cantidades ni el tenant del registro. |
| Consulta de existencias | Resolver el producto y las dimensiones acordadas dentro del tenant; consultar su saldo; aplicar el comportamiento aprobado para saldo ausente. | Vista de existencias con su unidad; no se inventa un cero ni se promete disponibilidad reservable. |

Cada secuencia sucede dentro de la operación autorizada por tenancy. Los pasos que dependen de Q-1 a Q-10 son parte del diseño para revisar, no reglas ya aprobadas.

### Contrato público para consumidores

- Los contratos que se aprueben se publicarán en `inventory.api`, propiedad de Inventory; el consumidor POS no puede definir ni duplicar su modelo.
- Las entradas transportarán únicamente IDs y datos acordados. La autorización proviene del contexto validado y nunca de un `tenant_id`, actor o permiso libre del cliente.
- Las respuestas serán DTOs/records con los campos necesarios para el consumidor, sin repositorios, proxies de Hibernate, relaciones perezosas ni entidades persistentes.
- La consulta de catálogo no garantiza stock al registrar una venta. POS deberá usar el contrato de disponibilidad y movimientos que cierre INV-002 y ejecute INV-003.
- Se coordinarán los cambios incompatibles con el consumidor antes de implementarlos. No se añaden eventos sin propósito y consumidor acordados.

### Solicitudes, respuestas y puertos conceptuales

Estos nombres documentan responsabilidades; no son DTOs Java vacíos ni un esquema de producto implícito.

| Contrato conceptual | Contenido confirmado | Contenido por acordar |
| --- | --- | --- |
| Solicitud de alta | Datos comerciales del producto; no incluye identidad del actor ni tenant como autorización. | Campos, obligatoriedad y reglas de alta (Q-1/Q-2/Q-6). |
| Solicitud de edición | UUID del producto y los cambios permitidos; el tenant viene del contexto. | Lista de campos editables y semántica de omisión de valores (Q-6). |
| Solicitud de catálogo | Parámetros de página, tamaño máximo cinco y criterios de consulta. | Convención de página, filtros y orden comercial (Q-7). |
| Vista de producto | UUID técnico del producto. Datos suficientes para el consumidor, sin entidad JPA. | Proyección de campos comerciales y datos de auditoría que se deban exponer (Q-1). |
| Página de productos | Colección limitada de vistas públicas. | Metadatos y convención de navegación (Q-7). |
| Vista de existencias | Identificación del producto consultado en su tenant. | Cantidad, unidad, dimensiones, saldo ausente y relación con disponibilidad (Q-3/Q-4/Q-5/Q-10). |

Los puertos de salida del catálogo deberán permitir buscar producto por tenant e ID, guardar el producto dentro de ese tenant y consultar páginas con los filtros/orden aprobados. El puerto de consulta de existencias recibirá tenant, producto y dimensiones acordadas. No se expone ninguno de esos puertos a POS: sus consumidores pertenecen a la aplicación de Inventory y sus adaptadores a la infraestructura de Inventory.

### Errores conceptuales

Se deben distinguir entrada inválida, acceso no autorizado y recurso no encontrado. El producto de otro tenant responde igual que uno inexistente. La forma de las respuestas y códigos comerciales concretos se acuerda junto con cada caso; no se fijan HTTP, excepciones ni errores de SKU o cantidad inexistentes en los requisitos.

La política ante duplicados depende de Q-2. La respuesta ante saldo inexistente depende de Q-5. No se convierte una decisión desconocida en un resultado por defecto.

## Paginación y consultas obligatorias

- Máximo cinco elementos por página; la implementación debe rechazar tamaños superiores y parámetros inválidos antes de consultar.
- Filtrar, ordenar y paginar en PostgreSQL. No cargar el catálogo completo para paginar en memoria.
- Orden estable con desempate por ID. El orden comercial, filtros admitidos, convención de página y metadatos de respuesta se acuerdan en Q-7.
- No añadir índices especulativos. Definirlos según las consultas acordadas, planes de ejecución y mediciones representativas.
- Los registros eliminados lógicamente se excluyen cuando esa política aplique; Q-9 debe resolver su uso y el efecto sobre la unicidad.

## Distribución prevista de responsabilidades

| Capa dentro de Inventory | Responsabilidad futura |
| --- | --- |
| `api` | Contratos públicos revisados y documentación de consumo. |
| `domain/model`, `domain/service` | Modelo y reglas comerciales aprobadas, sin Spring/JPA. |
| `application/port/in`, `application/usecase` | Casos de uso explícitos, coordinación y propagación del contexto. |
| `application/port/out` | Puertos para persistencia y otras necesidades aprobadas; métodos tenant-scoped. |
| `application/dto` | Datos internos de aplicación que no exponen persistencia. |
| `infrastructure/persistence` | Entidades JPA, repositorios y adaptadores; queries filtradas y paginadas. |
| `presentation` | Traducción HTTP cuando se autorice; no concentra reglas de negocio. |

No se crean clases vacías para representar trabajo pendiente ni se añaden dependencias para este diseño.

## Persistencia y transacciones para la implementación posterior

El modelo se definirá Code First mediante entidades JPA dentro de Inventory y migraciones Flyway versionadas en la ubicación común del backend. No se cambia una migración ya aplicada, no se genera el dominio desde una base existente y Hibernate valida el esquema.

Las futuras tablas de negocio usan UUID, tenant obligatorio y constraints tenant-scoped; las relaciones producto-existencias impiden cruces de tenants. Se conserva la auditoría `created_at`, `updated_at`, `created_by`, `updated_by` según corresponda, con instantes UTC. Borrado lógico, retención y campos económicos requieren las decisiones pendientes.

Cada mutación acordada deberá ejecutar validación, escritura y auditoría de forma atómica dentro de la transacción autorizada. Si el alta incluye un saldo inicial tras resolver Q-5, ambos se confirman o revierten juntos; este diseño no decide que deba incluirlo. Se coordinará con INV-003 cualquier invariante que dependa de movimientos o reservas, sin permitir escrituras parciales o una vía de edición que eluda ese contrato.

RLS se implementará por tabla con `USING` y `WITH CHECK` según operación, sin contexto implica denegación y el rol runtime no será propietario privilegiado, superusuario ni `BYPASSRLS`. Los permisos de migración son distintos de los de runtime.

## Plan de pruebas ligado a decisiones

No se agregan pruebas ejecutables de un comportamiento todavía no definido ni pruebas que solo comprueban el texto de este documento. Cuando se acuerde e implemente cada caso, se incorporarán pruebas unitarias reales de dominio/aplicación y se ejecutarán las verificaciones pertinentes.

| Escenario | Resultado que se verificará | Nivel / condición |
| --- | --- | --- |
| Autorización rechazada por tenancy | No se llama al puerto de negocio ni se escribe | Unitaria del caso/frontera autorizada. |
| Consulta con contexto autorizado | El puerto recibe explícitamente el tenant validado | Unitaria de aplicación. |
| Producto inexistente o de otro tenant | Misma respuesta pública; sin revelar información ajena | Unitaria e integración. |
| Listado con tamaño superior a cinco o parámetros inválidos | Rechazo previo a la consulta | Unitaria, tras fijar contrato de página. |
| Listado válido | Paginación/filtro tenant/orden estable en PostgreSQL | Integración con consulta real. |
| Alta con datos válidos o inválidos | Resultado y validaciones aprobados, sin datos supuestos | Unitarias, después de Q-1/Q-2/Q-5/Q-6. |
| Identificador comercial repetido | Regla de unicidad acordada, con su alcance tenant | Unitaria e integración, después de Q-2/Q-9. |
| Edición de un campo no permitido o de saldo | Rechazo según el contrato de edición aprobado | Unitaria, después de Q-6. |
| Saldo ausente o con unidad/dimensión incorrecta | Comportamiento acordado, sin asumir cero | Unitarias, después de Q-3/Q-4/Q-5. |
| Error en una escritura compuesta | Rollback de todos los efectos y auditoría coherente | Integración cuando se apruebe esa escritura. |
| Referencia de existencias a producto de otro tenant | Constraint rechaza la relación | Integración con PostgreSQL. |
| Acceso sin contexto RLS y reutilización de conexión tras rollback | Denegación y ausencia de fuga de contexto | Integración con rol runtime. |

Las pruebas de integración/aislamiento y rendimiento se coordinan conforme a `docs/testing.md`; este diseño no cambia sus umbrales ni garantiza rendimiento sin mediciones.

## Decisiones pendientes para Jefferson

| ID | Pregunta concreta |
| --- | --- |
| Q-1 | ¿Qué campos comerciales tiene producto, cuáles son obligatorios y cuáles se exponen a POS? |
| Q-2 | ¿Existe un identificador comercial? ¿Formato, normalización y unicidad por tenant, incluyendo borrados? No se asume SKU. |
| Q-3 | ¿Qué unidades se admiten, existen fracciones y cuál es la representación/precisión de cantidades? |
| Q-4 | ¿El saldo se define por producto, por almacén o por otras dimensiones? ¿Qué cardinalidad y referencias se requieren? |
| Q-5 | ¿Crear producto crea existencias? ¿Qué valor inicial se autoriza y cómo se consulta un saldo todavía inexistente? |
| Q-6 | ¿Qué reglas habilitan alta/edición y qué campos pueden cambiar? ¿Precio o costo pertenecen a Inventory y, si corresponde, qué moneda y precisión usan? |
| Q-7 | ¿Qué filtros, orden comercial, convención de página y metadatos requiere el catálogo? |
| Q-8 | ¿Qué casos mínimos se aprueban y qué códigos de permiso requiere cada uno en TenantAccess? |
| Q-9 | ¿Se permite eliminar/desactivar producto? ¿Qué retención se exige y qué sucede si tiene existencias o movimientos? |
| Q-10 | ¿Qué consulta requiere POS: existencia registrada, disponibilidad o ambas, y cómo se coordina con reservas de INV-002? |

Hasta resolverlas, no se fijan entidades, migraciones ni defaults de negocio. Esta lista permite revisar decisiones concretas sin cambiar el alcance de otros módulos.

## Estado frente a los criterios de aceptación

| Criterio de INV-001 | Evidencia / estado |
| --- | --- |
| Catálogo y existencias tienen diseño inicial documentado | Modelo conceptual, relaciones, límites tenant y persistencia en este documento. |
| Casos de uso acordados preparados | Candidatos y contratos conceptuales documentados; acuerdo y código pendientes de las decisiones anteriores. |
| Pruebas unitarias para casos implementados | No hay casos implementados en esta entrega de diseño; matriz preparada para implementaciones posteriores. No se declara el criterio ejecutable satisfecho. |

La entrega de diseño queda preparada para revisión conforme al alcance actual de `docs/tasks/INV-001.md`. La aceptación del diseño, la implementación posterior y el cierre de la issue requieren revisión de los requisitos pendientes; este documento no sustituye esa aceptación.
