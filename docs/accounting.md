# ACC-001 — Diseño inicial del módulo contable

## Estado y alcance

Documento de diseño de la feature `accounting` (`backend/src/main/java/com/erp/features/accounting/`). Define cuentas, asientos y movimientos, los contratos del módulo y las reglas y pruebas unitarias iniciales. **No implementa código, migraciones ni pruebas ejecutables**; esas piezas se harán en tareas posteriores autorizadas.

Convención de este documento:

- **Definido**: se deriva de políticas ya aprobadas (`arquitectura.md`, `multitenancy.md`, `orm-code-first.md`, `testing.md`).
- **Propuesta (P-n)**: decisión de diseño sugerida que requiere aprobación de Jefferson antes de implementarse.
- **Pregunta abierta (Q-n)**: dato que no se puede suponer; se lista en la sección final.

Responsable: Esteban (`EMLarco`). Aprobación de alcance y criterios: Jefferson (`jeffersonmejia`).

## Modelo conceptual

El módulo sigue contabilidad de partida doble. Un **asiento** agrupa **movimientos** que afectan **cuentas**.

```text
Account 1 ───── * JournalLine * ───── 1 JournalEntry
(cuenta)          (movimiento)          (asiento)
```

- `JournalEntry` es la raíz del agregado y es propietaria de sus `JournalLine`. Los movimientos no existen ni se modifican fuera de su asiento.
- `Account` es un agregado independiente; los movimientos la referencian por `account_id`.

### Cuenta (`Account`)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | UUID | PK. |
| `tenant_id` | UUID NOT NULL | Tenant propietario. |
| `code` | texto | Código contable. Único por tenant: `UNIQUE (tenant_id, code)` (Q-2 sobre formato). |
| `name` | texto | Nombre visible. |
| `type` | enum texto | `ASSET`, `LIABILITY`, `EQUITY`, `INCOME`, `EXPENSE` (P-1). |
| `parent_id` | UUID nullable | Jerarquía dentro del mismo tenant (FK compuesta `(tenant_id, parent_id)`). Q-3: si el plan es jerárquico. |
| `postable` | boolean | Solo las cuentas imputables reciben movimientos (P-2). |
| `active` | boolean | Una cuenta inactiva no recibe movimientos nuevos. |
| auditoría | — | `created_at`, `updated_at`, `created_by`, `updated_by` (`orm-code-first.md`). |

Naturaleza de saldo (P-1): `ASSET` y `EXPENSE` son de naturaleza deudora; `LIABILITY`, `EQUITY` e `INCOME`, acreedora. Se deriva de `type`, no se almacena.

Las cuentas con movimientos contabilizados no se eliminan físicamente (definido por la política de registros contables); se desactivan.

### Asiento (`JournalEntry`)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | UUID | PK. |
| `tenant_id` | UUID NOT NULL | Tenant propietario. |
| `entry_number` | texto/secuencia | Número correlativo por tenant, `UNIQUE (tenant_id, entry_number)` (Q-4: formato y si admite huecos). |
| `entry_date` | fecha | Fecha contable (Q-5: zona horaria / período). |
| `description` | texto | Concepto. |
| `status` | enum texto | `DRAFT`, `POSTED`, `REVERSED` (P-3). |
| `reverses_entry_id` | UUID nullable | Si es un asiento de reversa, apunta al original (mismo tenant). |
| `posted_at` / `posted_by` | instante / UUID | Se completan al contabilizar. |
| auditoría | — | Igual que en cuenta. |

Ciclo de vida (P-3):

```text
DRAFT ──contabilizar──▶ POSTED ──revertir──▶ REVERSED
  │                        │
  └── editable/descartable └── inmutable; la corrección es un asiento compensatorio
```

Un asiento `POSTED` es inmutable y no se borra físicamente. Corregir un error implica crear un asiento de reversa (con los lados invertidos) que referencia al original y marca el original como `REVERSED`.

### Movimiento (`JournalLine`)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | UUID | PK. |
| `tenant_id` | UUID NOT NULL | Debe coincidir con el del asiento y el de la cuenta (FK compuestas). |
| `entry_id` | UUID | FK compuesta `(tenant_id, entry_id)` → asiento. |
| `account_id` | UUID | FK compuesta `(tenant_id, account_id)` → cuenta. |
| `side` | enum texto | `DEBIT` o `CREDIT`. |
| `amount` | `NUMERIC`/`BigDecimal` | Siempre > 0. El signo lo da `side`. Precisión y escala: Q-1. |
| `description` | texto nullable | Detalle del movimiento. |
| `line_number` | entero | Orden estable dentro del asiento. |

Se usa `side` + `amount` positivo en lugar de columnas débito/crédito separadas para que una línea no pueda tener ambos lados (P-4).

## Reglas de negocio iniciales

Cada regla se refuerza en el dominio y, cuando aplica, con constraints de PostgreSQL.

| ID | Regla | Refuerzo |
| --- | --- | --- |
| R-01 | Un asiento se contabiliza solo si la suma de débitos es igual a la suma de créditos. | Dominio; constraint diferible/verificación en la transacción de contabilización. |
| R-02 | Un asiento contabilizado tiene al menos dos movimientos. | Dominio. |
| R-03 | Todo `amount` es mayor que cero. | Dominio + `CHECK (amount > 0)`. |
| R-04 | Cada movimiento tiene exactamente un lado (`DEBIT` o `CREDIT`). | Enum + `NOT NULL`. |
| R-05 | Un movimiento solo puede usar cuentas activas e imputables del mismo tenant. | Dominio + FK compuesta con `tenant_id`. |
| R-06 | `code` de cuenta es único por tenant. | `UNIQUE (tenant_id, code)`. |
| R-07 | Un asiento `POSTED` o `REVERSED` no se modifica ni se elimina. | Dominio; restricción de actualización en persistencia. |
| R-08 | La corrección se hace con un asiento de reversa que invierte los lados del original; no se reescribe el original. | Dominio. |
| R-09 | Un asiento solo puede revertirse una vez. | `UNIQUE (tenant_id, reverses_entry_id)` parcial. |
| R-10 | No se cambia `type` ni se reasigna el `tenant_id` de una cuenta con movimientos contabilizados. | Dominio + constraint. |
| R-11 | Todos los movimientos de un asiento pertenecen al mismo tenant que el asiento. | FK compuesta. |
| R-12 | Toda operación recibe el contexto validado (`tenant_id`, `actor_id`) y filtra por él. | Caso de uso + RLS futura. |
| R-13 | Los listados paginan en la consulta con un máximo de 5 elementos y orden estable. | Validación en backend. |

Moneda: se asume una única moneda por tenant y asiento hasta que se decida lo contrario (Q-6). No se modela tipo de cambio en esta fase.

## Contratos del módulo

Los contratos siguen `arquitectura.md`: el dominio no depende de Spring/JPA; `presentation` invoca puertos de entrada; `infrastructure` implementa puertos de salida; no se exponen entidades JPA.

### Puertos de entrada (`application/port/in`)

Todos reciben un contexto validado `TenantContext(tenantId, actorId)` como primer parámetro. Su tipo concreto lo publicará `tenancy.api` (pendiente, Q-7); hasta entonces se documenta solo como valor de entrada.

| Puerto | Entrada | Salida | Errores de negocio |
| --- | --- | --- | --- |
| `CreateAccountUseCase` | `code`, `name`, `type`, `parentId?`, `postable` | `AccountView` | código duplicado, padre inexistente o de otro tenant |
| `UpdateAccountUseCase` | `accountId`, `name?`, `active?` | `AccountView` | cuenta inexistente; desactivar con restricción (R-10) |
| `GetAccountUseCase` | `accountId` | `AccountView` | no encontrada |
| `ListAccountsUseCase` | `page`, `size` (≤ 5), filtros opcionales | `Page<AccountView>` | tamaño inválido |
| `CreateDraftEntryUseCase` | `entryDate`, `description`, lista de líneas | `JournalEntryView` | línea inválida (R-03/R-04/R-05) |
| `PostEntryUseCase` | `entryId` | `JournalEntryView` | descuadre (R-01), menos de 2 líneas (R-02), estado inválido |
| `ReverseEntryUseCase` | `entryId`, `reason` | `JournalEntryView` (reversa) | asiento no contabilizado o ya revertido (R-09) |
| `GetEntryUseCase` | `entryId` | `JournalEntryView` con líneas | no encontrado |
| `ListEntriesUseCase` | `page`, `size` (≤ 5), rango de fechas opcional | `Page<JournalEntryView>` | tamaño inválido |

`*View` son DTOs de `application/dto`. Un asiento inexistente o de otro tenant responde igual (no encontrado) para no revelar su existencia.

### Puertos de salida (`application/port/out`)

| Puerto | Responsabilidad |
| --- | --- |
| `AccountRepository` | Guardar y buscar cuentas por `(tenantId, id)` o `(tenantId, code)`; listar paginado en la consulta. |
| `JournalEntryRepository` | Guardar el asiento con sus líneas como una unidad; buscar por `(tenantId, id)`; listar paginado. |
| `EntryNumberGenerator` | Asignar el siguiente número correlativo por tenant dentro de la transacción (Q-4). |
| `Clock` | Fuente de tiempo para `posted_at` y auditoría, para poder probar con tiempo fijo. |

Todos los métodos de repositorio reciben `tenantId` de forma explícita.

### Contrato público (`accounting.api`)

**Sin contrato público por ahora.** `arquitectura.md` indica que las integraciones de `accounting` con otros módulos se acuerdan en sus tareas y que, hasta entonces, permanece aislado. No se publican eventos ni interfaces en `api` hasta que se defina qué módulo consume qué (Q-8). Una integración futura típica (por ejemplo, que `pos` registre ventas) debería publicarse aquí, definida por `accounting`, y acordarse en las tareas de ambas features.

### Límite transaccional

- `PostEntryUseCase`, `ReverseEntryUseCase` y `CreateDraftEntryUseCase` ejecutan en una sola transacción: validar, asignar número, guardar asiento y líneas; sin escrituras parciales.
- Contabilizar y revertir deben ser seguros ante concurrencia: dos solicitudes sobre el mismo asiento no pueden producir dos reversas (R-09) ni contabilizar dos veces.

## Persistencia (resumen para la implementación posterior)

Cumple `orm-code-first.md`: entidades JPA solo en `infrastructure/persistence`, UUID como PK, enums como texto, `NUMERIC` para importes, migración Flyway por cambio de esquema (por ejemplo `V<fecha>_001__accounting_create_accounts.sql`), `tenant_id NOT NULL`, claves únicas y FK compuestas con `tenant_id`, y RLS según `multitenancy.md`. Índices y retención: Q-9.

## Plan de pruebas unitarias iniciales

Pruebas del dominio y de los casos de uso con puertos simulados, sin base de datos ni Spring. Las implementa y ejecuta quien corresponda según `testing.md` una vez exista el código.

| ID | Escenario | Resultado esperado | Regla |
| --- | --- | --- | --- |
| T-01 | Asiento con débitos = créditos y 2 líneas | Se contabiliza (`POSTED`) | R-01, R-02 |
| T-02 | Asiento con débitos ≠ créditos | Rechazado, sin cambios de estado | R-01 |
| T-03 | Asiento con una sola línea | Rechazado | R-02 |
| T-04 | Línea con monto 0 o negativo | Rechazada | R-03 |
| T-05 | Línea sin lado | Rechazada | R-04 |
| T-06 | Línea con cuenta inactiva | Rechazada | R-05 |
| T-07 | Línea con cuenta no imputable | Rechazada | R-05 |
| T-08 | Línea con cuenta de otro tenant | Rechazada como no encontrada | R-05, R-12 |
| T-09 | Crear cuenta con código existente en el mismo tenant | Rechazada | R-06 |
| T-10 | Mismo código en tenants distintos | Permitido | R-06 |
| T-11 | Modificar asiento `POSTED` | Rechazado | R-07 |
| T-12 | Revertir asiento `POSTED` | Crea reversa con lados invertidos; original `REVERSED` | R-08 |
| T-13 | Revertir asiento ya revertido | Rechazado | R-09 |
| T-14 | Revertir asiento en `DRAFT` | Rechazado | R-08 |
| T-15 | Suma con `BigDecimal` de importes con decimales (p. ej. 0.1 + 0.2 vs 0.3) | Cuadra sin error de redondeo | R-01 |
| T-16 | Listar con `size` > 5 | Rechazado por validación | R-13 |
| T-17 | Caso de uso sin contexto de tenant | Rechazado antes de acceder a datos | R-12 |
| T-18 | Contabilizar descuadrado no deja líneas ni número consumido | Sin efectos parciales (con puertos simulados) | R-01 |

Cobertura objetivo: la política de `docs/quality.md` (cobertura diferencial mínima del 80% en PR hacia `develop`). Las pruebas de integración (constraints, FK compuestas, concurrencia sobre reversa, RLS) y de aislamiento tenant quedan para la implementación y las ejecuta Jennifer con los criterios que defina Jefferson.

## Preguntas abiertas para Jefferson

| ID | Pregunta |
| --- | --- |
| Q-1 | ¿Precisión y escala monetaria (`NUMERIC(p, s)`) y política de redondeo? |
| Q-2 | ¿Formato del código de cuenta (longitud, numérico/alfanumérico, separadores)? |
| Q-3 | ¿El plan de cuentas es jerárquico (`parent_id`) o plano? ¿Se incluye un plan base por defecto al crear un tenant? |
| Q-4 | ¿Formato de `entry_number` (por tenant, por año)? ¿Se aceptan huecos de numeración? |
| Q-5 | ¿Existen períodos contables con cierre? ¿Se permiten asientos con fecha en períodos cerrados? |
| Q-6 | ¿Una sola moneda por tenant en el MVP o multimoneda? |
| Q-7 | ¿Qué tipo publicará `tenancy.api` para el contexto validado, y qué permisos se exigen (por ejemplo para contabilizar o revertir)? |
| Q-8 | ¿Qué módulos generarán asientos (por ejemplo `pos`) y mediante interfaz o evento? ¿Los asientos automáticos nacen directamente `POSTED`? |
| Q-9 | ¿Retención de datos contables e índices requeridos según consultas reales? |
| Q-10 | ¿Se confirman las propuestas P-1 a P-4 (tipos de cuenta, cuentas imputables, ciclo de vida del asiento y modelo `side` + `amount`)? |

Hasta resolver estas preguntas, la implementación (entidades, migraciones, casos de uso) no debe iniciar.
