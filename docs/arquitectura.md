# ARC-001 — Contratos y límites de arquitectura

## Objetivo y alcance

El backend se organiza como un monolito modular Java/Spring Boot con módulos por feature y arquitectura hexagonal. Cada módulo es dueño de su lógica y persistencia. Esta guía define los límites iniciales para que los equipos puedan implementar features en paralelo; no define todavía todos los casos de uso ni implementa código de aplicación.

## Módulos y responsabilidades

| Módulo | Responsabilidad y propiedad |
| --- | --- |
| `identity` | Identidades y contratos de actor autenticado. No contiene reglas de los módulos de negocio. |
| `tenancy` | Resolución del tenant y contexto de aislamiento disponible para las features. |
| `crm` | Clientes y sus operaciones propias. Publica contratos para consumidores autorizados. |
| `pos` | Flujo de ventas. Solicita operaciones de inventario mediante el contrato público de `inventory`. |
| `inventory` | Productos, existencias y movimientos. Es dueño de sus reglas y ofrece el contrato requerido por POS. |
| `accounting` | Cuentas y movimientos contables. Sus integraciones con otros módulos quedan pendientes de acordar en su tarea. |
| `projects` | Proyectos, tareas y estados, sin acceso a datos internos de otras features. |
| `marketing` | Campañas y contactos; su integración con clientes utiliza el contrato público de `crm`. |
| `shared` | Tipos técnicos realmente transversales. No debe contener reglas, entidades ni repositorios de negocio. |

Cada módulo es propietario de sus modelos, reglas, tablas y adaptadores. Una feature no consulta las tablas de otra ni importa sus entidades, repositorios, controladores o adaptadores.

## Capas dentro de una feature

La estructura física está bajo `backend/src/main/java/com/erp/features/<feature>/`. El paquete `api` representa el límite público que otras features pueden consumir; el resto es interno.

```text
feature/
├── api/                         # Contratos públicos y eventos publicados
├── domain/                      # Modelo y reglas del dominio
├── application/                 # Casos de uso y puertos
├── infrastructure/              # Persistencia y adaptadores externos
└── presentation/                 # HTTP, solicitudes y respuestas
```

Las dependencias internas apuntan hacia el dominio: `presentation` invoca `application`; `application` coordina el dominio y define puertos; `infrastructure` implementa puertos. El dominio no depende de Spring, HTTP, JPA ni de otra feature.

## Dependencias entre módulos

Las únicas dependencias entre features son a través del contrato público de la proveedora (`<feature>.api`) o de eventos publicados por ella. No se accede a paquetes internos ni a la base de datos de otra feature.

| Consumidor | Proveedor permitido | Motivo |
| --- | --- | --- |
| Cualquier feature | `tenancy.api` | Recibir el contexto del tenant requerido por la operación. |
| Cualquier feature que necesite identificar al actor | `identity.api` | Consumir el identificador y contexto público del actor; no consultar su almacenamiento. |
| `pos` | `inventory.api` | Solicitar las operaciones de inventario que requiera el flujo de ventas, según el contrato POS-001. |
| `marketing` | `crm.api` | Consumir los contratos de clientes previstos para Marketing. |
| `accounting` y otras features | Ninguno predefinido | Las integraciones se acuerdan en sus tareas; hasta entonces permanecen aisladas. |

`inventory` no depende de `pos`: expone su contrato y POS lo consume. `shared` puede ser usado por las features para primitivas técnicas estables, pero nunca para saltarse un contrato de negocio. No se permiten dependencias circulares. Si una interacción no está en esta tabla, se acuerda y documenta en las tareas de ambas features antes de implementarla.

## Contratos

- La feature proveedora es dueña del contrato que publica en `api`; los consumidores no definen ni duplican el modelo de la proveedora.
- Los contratos contienen solo datos y operaciones necesarios para la interacción. No exponen entidades JPA, repositorios ni clases internas.
- Una operación que necesita respuesta inmediata usa una interfaz pública de aplicación. Para efectos que no requieren respuesta inmediata, la proveedora puede publicar un evento con un nombre y contenido acordados. No se crean eventos de negocio sin consumidores y propósito definidos.
- Los cambios incompatibles requieren coordinar proveedor y consumidores en el mismo cambio integrado, o publicar una transición compatible y retirar el contrato anterior después de migrarlos.
- Los identificadores de otras features se transportan como valores de contrato; no habilitan acceso directo a sus registros.

## Multitenancy y datos

PostgreSQL es compartido. Toda consulta o escritura sobre datos pertenecientes a un tenant debe recibir el contexto de `tenancy` y limitarse a ese `tenant_id`. Los datos globales y las excepciones deben documentarse explícitamente. El modelo, el flujo de contexto y las responsabilidades de RLS están definidos en [ARC-002](multitenancy.md); su implementación sigue pendiente.

La política para JPA/Hibernate Code First, migraciones Flyway y convenciones de persistencia está en [Persistencia ORM Code First](orm-code-first.md). Su implementación también sigue pendiente.

## Criterios de integración

Un cambio que integra o modifica una feature debe cumplir lo siguiente antes de incorporarse a `develop`:

1. Respeta la propiedad del módulo y la dirección de dependencias de sus capas.
2. Los consumidores usan únicamente contratos públicos; no hay importaciones de paquetes internos ni acceso a tablas de otras features.
3. La interacción entre módulos aparece en esta guía y en las tareas afectadas; no introduce ciclos.
4. Los cambios de contrato incluyen revisión de proveedor y consumidores, con pruebas de contrato o de integración cuando exista la implementación.
5. Las operaciones con datos tenant reciben el contexto tenant y preservan el aislamiento; las reglas de RLS se validan al implementar ARC-002.
6. La construcción y las verificaciones pertinentes pasan en CI. Cuando exista código Spring Modulith, se añade una verificación de límites de módulos.
7. La integración se hace mediante Pull Request a `develop`; después de revisar esa rama, los cambios llegan a `main` mediante Pull Request.

## Decisiones todavía abiertas

ARC-001 establece límites y dependencias iniciales. No determina reglas de negocio, esquemas completos, eventos específicos de ventas/contabilidad, autenticación, RLS ni operaciones concretas de cada API. Esas decisiones se documentan con las tareas de las features afectadas antes de implementarlas.
