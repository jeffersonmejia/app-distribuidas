# Reglas de desarrollo

## Alcance y calidad

- Aplican a todas las personas y herramientas de IA, sin importar proveedor o modelo. Lee estas reglas y las instrucciones locales antes de cambiar código.
- Mantén la arquitectura Feature-First y limita cada cambio al alcance solicitado. Prefiere soluciones claras, pequeñas, mantenibles y con tipos explícitos; evita duplicación y abstracciones prematuras.
- Los cambios funcionales deben incluir o actualizar pruebas pertinentes. Ejecuta y reporta las verificaciones relevantes; no afirmes que algo funciona si no lo comprobaste.

## Seguridad

- Usa [OWASP Top 10:2025](https://top10.owasp.org/2025/) como línea base mínima de seguridad, no como garantía completa. Considera control de acceso, validación, inyección, configuración, dependencias, criptografía, integridad, registro y manejo seguro de errores.
- Aplica autorización en el backend, especialmente al acceder a datos por tenant. No confíes en validaciones del frontend.
- No guardes secretos en Git ni los expongas en logs, errores, respuestas o comandos compartidos. Valida entradas y usa consultas parametrizadas.

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
- Usa Conventional Commits: `tipo(scope): descripción`, con tipo y scope en minúsculas; el scope es opcional. Los únicos tipos permitidos son `feat`, `fix` y `refactor`.
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
- Integra `develop` en `main` mediante un Pull Request. `main` requiere Pull Requests; no hagas push ni merge directo a esa rama.
- Mantén los cambios de cada tema en commits separados y con Conventional Commits.
