# Reglas de desarrollo

## Alcance y calidad

- Aplican a todas las personas y herramientas de IA, sin importar proveedor o modelo. Lee estas reglas y las instrucciones locales antes de cambiar código.
- Mantén la arquitectura Feature-First y limita cada cambio al alcance solicitado. Prefiere soluciones claras, pequeñas, mantenibles y con tipos explícitos; evita duplicación y abstracciones prematuras.
- Los cambios funcionales deben incluir o actualizar pruebas pertinentes. Ejecuta y reporta las verificaciones relevantes; no afirmes que algo funciona si no lo comprobaste.
- En el scaffolding, conserva con `.gitkeep` los directorios requeridos que estén vacíos; retira el marcador al agregar contenido real y nunca lo sustituyas por código ficticio.

## Equipo y responsabilidades

Antes de aplicar autoridad o responsabilidades personales, identifica al solicitante con GitHub CLI (`gh api user --jq .login`). Aplica el rol y la autoridad de Jefferson descritos aquí únicamente si el comando confirma exactamente `jeffersonmejia`. No infieras su identidad por la rama activa, la ruta, el nombre visible ni el historial. Si GitHub CLI no confirma esa cuenta, ignora esta instrucción especial de autoridad de Jefferson y sigue únicamente las instrucciones explícitas y autorizadas del solicitante; si el alcance no queda claro, consúltalo antes de cambiarlo. No pidas al solicitante que vuelva a explicar esta regla en cada asignación.

| Persona | Usuario de GitHub | Rol |
| --- | --- | --- |
| Jefferson | `jeffersonmejia` | Backend y DevOps. Define arquitectura, alcance y decisiones técnicas. |
| Bruce | `BruceRodri` | Backend. Ejecuta trabajo asignado por feature. |
| Esteban | `EMLarco` | Backend. Ejecuta trabajo asignado por feature. |
| Sahid | `Sahid-B` | Backend. Ejecuta trabajo asignado por feature. |
| Dayanara | `Dayanarablb` | Frontend. Ejecuta trabajo de frontend con alcance definido. |
| Jennifer | `Jntorres2001` | Testing y calidad: pruebas unitarias, de integración y de rendimiento con k6; revisión preventiva de calidad y hallazgos con análisis estático/SonarQube local. Ejecuta y reporta con alcance y criterios definidos. |

Jefferson es responsable de definir el alcance y los criterios de aceptación. El resto del equipo ejecuta tareas ya definidas; no debe tomar decisiones de alcance por su cuenta. Si una decisión o requisito no está definido, registra la pregunta y consúltala con Jefferson antes de implementarlo.

### Asignación y coordinación por feature

- El trabajo backend se reparte por feature. Cada tarea debe indicar con claridad la feature, su responsable y las rutas que modifica para evitar cambios simultáneos sobre el mismo alcance.
- Antes de iniciar una tarea, revisa GitHub Projects y las tareas relacionadas para detectar dependencias o trabajo concurrente sobre la misma feature.
- Si dos tareas chocan o requieren modificar el mismo alcance de una feature, no implementes ambas en paralelo. Marca como `Blocked` en GitHub Projects la tarea que debe esperar, indica cuál trabajo la bloquea y quién debe completarlo. Reanúdala cuando se resuelva el conflicto.
- No marques tareas bloqueadas por una duda de diseño como listas para ejecución; consulta a Jefferson y actualiza el alcance primero.
- Jennifer ejecuta las pruebas unitarias, de integración y de rendimiento con k6 que correspondan a las features implementadas, siguiendo criterios y umbrales definidos por Jefferson. No se crean pruebas de aplicación durante el scaffolding inicial prohibido por `requerimientos_iniciales.md`.
- El bloqueo de pruebas de integración o rendimiento por dependencias no impide asignar a Jennifer revisiones independientes de código ya implementado. Puede ejecutar análisis estático/SonarQube Community local, revisar hallazgos y reportar evidencia y recomendaciones al responsable de la feature, sin modificar código ajeno ni cambiar criterios de aceptación. Estas revisiones no se bloquean ni hacen gate de PR por SonarQube.
- En QA-005, Jennifer usa SonarQube para revisar el código de forma continua y ayudar a corregir hallazgos mientras avanza el desarrollo. Registra evidencia en `docs/quality-templates/formato_sonar_qube.docx`, prepara un PDF breve con imagen, descripción, prioridad y responsable, y avisa por el grupo de WhatsApp del proyecto mencionando al responsable y pidiendo atención pronta según prioridad. Prioriza P0 los riesgos de seguridad, exposición de datos o aislamiento tenant; P1 los defectos críticos/altos en flujos principales; P2 los defectos relevantes; P3 los hallazgos menores. No incluyas secretos ni datos reales de clientes/tenants en evidencia. SonarQube ayuda a corregir sobre la marcha, no es un gate de PR.

### Política de calidad obligatoria

- Antes de configurar, ejecutar, revisar o aceptar análisis estático, cobertura o Quality Gates, lee y aplica `docs/quality.md`.
- El criterio aprobado para Pull Requests nuevos hacia `develop` es cobertura diferencial mínima del 80%, análisis CodeQL con cero alertas de seguridad High/Critical y cero alertas generales Error; los hallazgos de seguridad deben revisarse manualmente.
- SonarQube Community es opcional para análisis local y no participa en el gate de PR. No contratar ni requerir ediciones o servicios de pago para esta política.
- El workflow y la cobertura diferencial están en `.github/workflows/quality-gate.yml`, `backend/pom.xml` y `frontend/package.json`. Esto prepara los checks, pero no prueba que el bloqueo de merges esté activo.
- No afirmes que el gate bloquea merges hasta verificar un análisis CodeQL exitoso y los checks/severidades requeridos en el ruleset de `develop`.
- El scaffolding inicial excluido por `requerimientos_iniciales.md` no incluye estos controles; su configuración se hace únicamente en una tarea posterior autorizada y con umbrales definidos.

## Seguridad

- Usa [OWASP Top 10:2025](https://top10.owasp.org/2025/) como línea base mínima de seguridad, no como garantía completa. Considera control de acceso, validación, inyección, configuración, dependencias, criptografía, integridad, registro y manejo seguro de errores.
- Aplica autorización en el backend, especialmente al acceder a datos por tenant. No confíes en validaciones del frontend.
- No guardes secretos en Git ni los expongas en logs, errores, respuestas o comandos compartidos. Valida entradas y usa consultas parametrizadas.

## Multitenancy obligatoria

Antes de diseñar, revisar o modificar código, consultas, datos, APIs o tareas que puedan acceder a datos de tenants, lee y aplica `docs/multitenancy.md`. Sus decisiones son obligatorias para todas las personas y herramientas de IA que trabajen en este repositorio.

- Autoriza cada acceso tenant-scoped en el backend usando el actor autenticado y una membresía activa validada por `tenancy`. Nunca confíes en un `tenant_id`, `actor_id` o permiso enviado por el frontend como autorización.
- Propaga explícitamente el contexto validado de `tenant_id` y `actor_id` hasta cada caso de uso tenant-scoped. No uses contexto global ni lo reutilices entre solicitudes.
- Toda tabla con datos de negocio de un tenant debe incluir `tenant_id NOT NULL`. Filtra todas sus lecturas y escrituras por el tenant validado y protege las relaciones y claves únicas para impedir referencias o colisiones entre tenants. Las excepciones globales deben estar identificadas y justificadas en la documentación.
- Cuando se implemente RLS, las políticas deben fallar cerradas, cubrir lectura y escritura con `USING` y `WITH CHECK` según corresponda y aplicarse con un rol de runtime que no sea superusuario, propietario privilegiado ni tenga `BYPASSRLS`. No desactives ni omitas RLS para solucionar errores de autorización.
- Si se usa `app.tenant_id` en PostgreSQL, establécelo solo dentro de la transacción después de validar la membresía; nunca lo establezcas a nivel de sesión ni lo aceptes directamente del cliente.
- Mantén límites transaccionales explícitos para operaciones tenant-scoped y preserva atomicidad, consistencia, aislamiento y durabilidad.
- La arquitectura está definida, pero autenticación, autorización ejecutable, propagación de contexto, columnas `tenant_id`, políticas RLS y pruebas de aplicación siguen pendientes de implementación. No afirmes que el aislamiento ya existe ni lo implementes durante una tarea de scaffolding que lo prohíba.
- Si una tarea no especifica cómo respeta este modelo o plantea una excepción, no inventes una política ni debilites el aislamiento: registra la duda, marca la tarea como `Blocked` en GitHub Projects cuando corresponda y consulta a Jefferson antes de continuar.

## Persistencia ORM Code First obligatoria

Antes de diseñar o modificar entidades, repositorios, relaciones o esquema de base de datos, lee y aplica `docs/orm-code-first.md` junto con `docs/multitenancy.md`. La política de JPA/Hibernate Code First y Flyway definida allí es obligatoria para todas las personas y herramientas de IA.

- El enfoque del proyecto es **Code First obligatorio**: define y mantiene el modelo persistente en el código JPA/Hibernate de cada feature; crea o actualiza la base mediante migraciones Flyway revisadas. No adoptes Database First ni generes entidades desde una base de datos existente como fuente del modelo.
- Si el esquema existente y las entidades JPA discrepan, no cambies entidades para imitar silenciosamente la base ni alteres una migración aplicada: identifica la discrepancia, prepara una migración correctiva compatible y consulta a Jefferson si afecta reglas de negocio o datos.

- Mantén entidades JPA y adaptadores en `infrastructure/persistence`; el dominio y las APIs no dependen de JPA ni exponen entidades persistentes.
- Cada cambio de esquema debe incluir una migración Flyway versionada y coordinada con la feature propietaria. Hibernate valida el esquema; no uses `ddl-auto=update`, `create` ni `create-drop` en bases persistentes/compartidas.
- Usa UUID para las entidades persistentes, constraints en PostgreSQL para invariantes, enums como texto, `BigDecimal` para dinero y convenciones de auditoría/borrado lógico de `docs/orm-code-first.md`.
- Toda tabla de negocio tenant-scoped conserva `tenant_id NOT NULL`, constraints tenant-scoped y las reglas de contexto/RLS de la política multitenant.
- No inventes precision monetaria, claves naturales, índices ni política de retención para una feature: consúltalo con Jefferson antes de implementar. No modifiques una migración ya aplicada en un entorno compartido.

## Herramientas y cambios

- Usa `rg`/ripgrep para buscar texto y archivos. Si no está instalado, instala ripgrep con el gestor de paquetes disponible antes de continuar.
- Para modificaciones puntuales, usa `apply_patch`. Después revisa el diff y confirma que solo cambiaste los archivos necesarios.

## SOLID y ACID

- Aplica los principios SOLID donde correspondan, sin forzar capas o patrones que no aporten claridad.
- Encima de cada clase o función donde se aplique un principio SOLID, añade un comentario breve en mayúsculas: `//SOLID: SRP — ESTA CLASE TIENE UNA SOLA RESPONSABILIDAD.` Usa el principio y la descripción que correspondan.
- ACID es obligatorio en transacciones de base de datos: define límites transaccionales explícitos y conserva atomicidad, consistencia, aislamiento y durabilidad. Refuerza invariantes con restricciones de base de datos; evita escrituras parciales.

## Paginación y rendimiento

- Limita cada página a un máximo de 5 elementos. Valida el límite en el backend y pagina en la consulta a la base de datos; no cargues todo el conjunto para paginarlo en memoria. Usa orden estable.
- Considera pruebas de rendimiento parte del ciclo de desarrollo. Mide con datos y carga representativos, identifica cuellos de botella con perfiles y planes de consulta, compara alternativas y elige la solución con mejores resultados medidos. Evita optimizar por intuición.

## Entrega

- Resume qué cambió, qué verificaste y cualquier limitación relevante. No hagas commits automáticamente; hazlos solo si te lo piden.

## Commit y push

- La configuración compartida y las dependencias de Commitlint están en la raíz: `commitlint.config.cjs` y `package.json`.
- Usa Conventional Commits: `tipo(scope): descripción`, con tipo y scope en minúsculas; el scope es opcional. Los únicos tipos permitidos son `feat`, `fix`, `refactor` y `docs`.
- Ejemplos válidos: `feat(crm): agrega clientes`, `fix: corrige cálculo`, `docs: actualiza guía`.
- Antes de confirmar, prepara solo los archivos del cambio y revisa lo que enviarás:

  ```bash
  git status
  git add <rutas-del-cambio>
  git diff --cached
  git commit -m "feat(crm): agrega clientes"
  ```

- Valida todos los commits que entrarán al PR contra su rama base (`develop` o `main`), no solo el último. Desde la raíz del repo:

  ```bash
  git fetch origin
  npx --no-install commitlint --from origin/develop --to HEAD --verbose
  ```

  Sustituye `origin/develop` por `origin/main` si esa es la base del PR. Si falla, corrige cada mensaje inválido antes de hacer push. El workflow de GitHub ejecuta esta misma validación para todos los commits del PR.
- En el primer push de una rama, establece upstream; en los siguientes, usa `git push`:

  ```bash
  git push --set-upstream origin feat/crm-clientes
  ```

- Si el remoto rechaza el push porque la rama base avanzó, actualiza referencias y rebasa sobre la rama base antes de revalidar y volver a enviar:

  ```bash
  git fetch origin
  git rebase origin/develop
  ```

  Reemplaza `develop` por `main` cuando corresponda y resuelve conflictos antes de continuar. No uses `git push --force`.

## Flujo de integración

- Usa las ramas de trabajo existentes; no crees ramas temporales para tareas de documentación o gestión del proyecto.
- Para el trabajo de Jefferson, confirma y publica los cambios en `Jefferson`.
- Integra `Jefferson` en `develop` después de validar los commits y revisar el cambio.
- Integra `develop` en `main` mediante un Pull Request con al menos una aprobación. `main` requiere Pull Requests y revisión manual; no hagas push ni merge directo a esa rama.
- Mantén los cambios de cada tema en commits separados y con Conventional Commits.
