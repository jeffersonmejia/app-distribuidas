# INV-002 — Contrato de movimientos de inventario para POS

## Alcance y estado

Issue #6, rama Sahid, responsable Sahid-B. Esta entrega contiene exclusivamente interfaces, records, enums y documentación. La implementación de movimientos y disponibilidad pertenece a INV-003; el catálogo pertenece a INV-001. No agrega controladores, entidades, migraciones ni reglas ejecutables.

El contrato está en `com.erp.features.inventory.api`. POS consume únicamente ese paquete; inventario no importa POS, ni POS puede consultar repositorios o tablas de inventario. Véanse [arquitectura](arquitectura.md), [multitenancy](multitenancy.md), [persistencia](orm-code-first.md) y [pruebas](testing.md).

La captura proporcionada muestra INV-002 en Todo y ARC-001/ARC-002 completadas, sin dependencias pendientes para esta tarea. No se modificó el tablero ni se declara una aprobación del consumidor que todavía no se ha obtenido.

## Contexto multitenant obligatorio

Cada método recibe `UUID tenantId` y `UUID actorId` explícitos. Son la proyección del contexto autenticado y autorizado por `tenancy`, no valores que un controlador deba copiar libremente del cliente. La firma es una frontera interna entre módulos, no una API HTTP ni una garantía de autorización por sí misma.

La implementación debe rechazar contextos ausentes o inválidos, validar membresía activa y permisos antes de acceder a negocio y aplicar el tenant a todas las consultas y escrituras. Las referencias a productos y reservas de otro tenant responden igual que las inexistentes. El contexto no es global ni se conserva entre solicitudes.

No se define un tipo de contexto alternativo en inventario. Cuando `tenancy.api` publique su tipo definitivo, se coordinará la adaptación compatible de este contrato. Los resultados incluyen el tenant validado; el actor de auditoría se obtiene del mismo contexto.

## Tipos públicos

| Tipo | Campos / significado |
| --- | --- |
| `StockLine` | `productId: UUID`, `quantity: BigDecimal`. Cantidad exacta positiva; no representa dinero. |
| `ReceiveStockCommand` | `operationKey`, `sourceReference`, `lines: List<StockLine>`. |
| `IssueStockCommand` | Los mismos campos, para una salida directa. |
| `ReserveStockCommand` | Los mismos campos, para comprometer disponibilidad. |
| `ReservationCommand` | `operationKey`, `reservationId: UUID`, `sourceReference`. |
| `MovementResult` | `tenantId`, `movementId`, `sourceReference`, `type`, `lines`, `occurredAt: Instant` UTC, `actorId`. |
| `ReservationResult` | `tenantId`, `reservationId`, `sourceReference`, `lines`, `status`, `movementId`. Este último es nulo en ACTIVE/RELEASED y obligatorio en CONFIRMED. |
| `MovementType` | RECEIPT, ISSUE. |
| `ReservationStatus` | ACTIVE, CONFIRMED, RELEASED. |
| `InventoryResult<T>` | Resultado sellado: `Success<T>(value)` o `Failure<T>(code)`. |

UUID identifica registros de inventario. La referencia de origen es un texto opaco de correlación con la venta; no permite consultar POS ni acredita autorización. Las claves de operación son textos opacos para reintentos.

Los records son portadores de datos sin constructores de validación, copias defensivas ni lógica. En particular, `List` no garantiza inmutabilidad profunda: la implementación futura debe validar y tomar instantáneas de entrada y salida; ningún consumidor debe mutarlas durante una llamada. Un éxito requiere valor no nulo y un fallo requiere código no nulo.

## Interfaz InventoryMovements

Todos los métodos reciben primero `tenantId` y `actorId`.

| Método | Parámetro restante | Resultado exitoso | Semántica propuesta |
| --- | --- | --- | --- |
| `receive` | `ReceiveStockCommand` | `MovementResult` RECEIPT | Incrementa existencia física y registra entrada. |
| `issue` | `IssueStockCommand` | `MovementResult` ISSUE | Disminuye existencia física usando solo disponibilidad libre. |
| `reserve` | `ReserveStockCommand` | `ReservationResult` ACTIVE | Compromete disponibilidad sin reducir existencia física. |
| `confirmReservation` | `ReservationCommand` | `ReservationResult` CONFIRMED | Consume las cantidades almacenadas en la reserva y registra una única salida. |
| `releaseReservation` | `ReservationCommand` | `ReservationResult` RELEASED | Libera lo reservado sin incrementar existencia física. |
| `getReservation` | `UUID reservationId` | `ReservationResult` | Consulta la reserva en el tenant autorizado. |

No se incluyen listados. Una ampliación con listados deberá paginar en base de datos, con orden estable y máximo cinco elementos.

## Semántica propuesta para revisión

Estas reglas documentan la intención del contrato y requieren revisión de Jefferson y Bruce antes de implementar; los tipos Java no las ejecutan.

- Disponibilidad = existencia física menos cantidad reservada. No se permiten saldos negativos ni salidas directas que consuman unidades reservadas.
- Cada comando de líneas requiere una lista no vacía, productos no duplicados y cantidades positivas. Se usa BigDecimal como representación exacta; unidad, fracciones admitidas, precisión y escala siguen pendientes de INV-001.
- Solo ACTIVE permite confirmar o liberar. CONFIRMED y RELEASED son terminales. Una transición nueva desde un estado terminal produce conflicto. Confirmación y liberación son totales; no se presupone soporte parcial ni vencimiento automático.
- La referencia de origen debe coincidir con la asociada a la reserva. La autorización sigue siendo obligatoria aunque coincidan las referencias.
- Una operación de varias líneas es atómica: o valida y persiste todas, o no modifica ninguna. Saldos, reserva, movimiento y resultado idempotente se guardan en una misma transacción.
- Una clave se interpreta por tenant y método. Misma clave y contenido devuelve el resultado original sin repetir efectos; contenido distinto produce conflicto. Confirmar/liberar usan claves distintas de la creación de la reserva. Formato, canonicalización y retención requieren definición antes de implementar.
- La concurrencia no permite sobreventa, doble confirmación ni confirmar y liberar simultáneamente. El mecanismo de persistencia se define y verifica en INV-003.
- Las tablas y relaciones futuras respetan tenant_id, constraints, RLS y rol runtime según ARC-002; no se agrega esquema en esta tarea.

Ejemplo: con 10 unidades físicas y 0 reservadas, reservar 3 deja 10 físicas, 3 reservadas y 7 disponibles. Confirmar deja 7 físicas, 0 reservadas y 7 disponibles. Liberar en vez de confirmar deja 10 físicas, 0 reservadas y 10 disponibles. Reintentar una confirmación idéntica no vuelve a descontar.

## Errores

`InventoryErrorCode` contiene:

| Código | Resultado esperado |
| --- | --- |
| INVALID_REQUEST | Datos obligatorios inválidos, lista vacía, cantidad no positiva o producto duplicado. |
| PRODUCT_NOT_FOUND | Producto inexistente o ajeno al tenant, sin distinguirlos. |
| RESERVATION_NOT_FOUND | Reserva inexistente o ajena al tenant, sin distinguirlas. |
| INSUFFICIENT_AVAILABILITY | Disponibilidad insuficiente en al menos una línea; rechazo total. |
| RESERVATION_STATE_CONFLICT | Transición no permitida. |
| SOURCE_REFERENCE_MISMATCH | Referencia distinta de la de la reserva autorizada. |
| IDEMPOTENCY_CONFLICT | Clave reutilizada con otro contenido. |
| CONCURRENT_OPERATION_CONFLICT | Conflicto de concurrencia sin efectos confirmados; reintentar con la misma clave. |

No se fijan códigos HTTP. Los fallos de autenticación/autorización pertenecen al contrato de seguridad común, pendiente de tenancy/identity; no son productos o reservas no encontrados. Los errores técnicos no revelan SQL, secretos ni datos ajenos. Un timeout no garantiza rollback: se reintenta con la misma clave para resolver el resultado.

## Consumo propuesto por POS

1. Obtener el contexto autorizado y una referencia estable de venta.
2. Invocar `reserve` con líneas y clave estable de reserva.
3. Para completar la venta, invocar `confirmReservation` con el ID devuelto y una clave estable de confirmación.
4. Para cancelar antes de confirmar, invocar `releaseReservation` con su propia clave estable.
5. Ante respuesta perdida, reintentar la misma intención con la misma clave y contenido.

La confirmación ya produce la salida: POS no debe invocar además `issue` para esa reserva. La salida directa es una alternativa cuyo uso debe acordarse en POS-001. Liberar una reserva confirmada no revierte una venta; devoluciones y compensaciones requieren otro contrato.

La atomicidad de cada llamada de inventario no garantiza atomicidad con guardar la venta o cobrar. El límite transaccional conjunto o la recuperación entre módulos requiere acuerdo con Jefferson y Bruce. No se crean eventos ni se define el flujo de pago en esta entrega.

## Pendientes antes de implementar

| Decisión | Coordinación |
| --- | --- |
| Aprobar semántica, estados y errores propuestos | Jefferson y Bruce. |
| Unidades, fracciones, escala, productos habilitados y almacenes | Jefferson / INV-001. Si hay almacenes, revisar el alcance de los IDs y comandos. |
| Tipo definitivo de contexto y permisos por operación | Jefferson / tenancy. |
| Formato de referencias, claves, canonicalización y retención idempotente | Jefferson y Bruce. |
| Límites de líneas y política de auditoría/retención | Jefferson. |
| Vencimiento, operaciones parciales, devolución y reservas abandonadas | Jefferson y Bruce. |
| Uso de reserva o salida directa; atomicidad y recuperación venta-inventario | Jefferson y Bruce / POS-001. |

## Verificación futura

Al existir implementación, verificar entradas/salidas/reservas y sus saldos; rechazo de líneas inválidas; rollback de todas las líneas ante un fallo; reintentos idénticos y claves conflictivas; reservas concurrentes sobre últimas unidades; confirmación contra liberación concurrente; aislamiento entre tenants; rechazo sin contexto autorizado; ausencia de fuga de contexto al reutilizar conexiones; fallo al persistir movimiento o resultado idempotente. Las pruebas de integración usarán el rol runtime definido en ARC-002.

Esta entrega no tiene lógica que probar funcionalmente. Se verifica compilación de contratos y alcance de archivos. La revisión del consumidor y aprobación de decisiones siguen pendientes; no se marca la issue como completada.

