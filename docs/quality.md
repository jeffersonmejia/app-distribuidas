# QUALITY-001 — Gate gratuito de calidad

## Alcance aprobado

El gate se ejecuta en Pull Requests dirigidos a `develop` y al actualizar esa rama. No requiere SonarQube Server, SonarQube Cloud, una licencia ni secretos externos.

- La cobertura de las líneas de código fuente nuevas o modificadas debe ser al menos **80%**.
- CodeQL analiza Java/Kotlin y JavaScript/TypeScript con las consultas `security-extended`; el paso Java se omite solo mientras el scaffolding no contenga fuentes `.java`.
- GitHub debe bloquear alertas nuevas de seguridad **High o Critical**, y alertas de calidad de severidad **Error**.
- Los hallazgos de seguridad restantes deben revisarse manualmente en GitHub antes de integrar el PR.
- Duplicación y code smells no bloquean esta etapa.

La cobertura diferencial se calcula con JaCoCo XML y LCOV usando ejecuciones separadas de `diff-cover`, porque los dos formatos no se pueden combinar en un solo informe. Cada lenguaje modificado debe cubrir al menos el 80% de sus líneas nuevas o modificadas. Los cambios que no tocan código cubierto no consumen el umbral. En `pull_request` se compara con la rama base; en `push`, con el commit anterior al push.

## Configuración del repositorio

- `.github/workflows/quality-gate.yml` ejecuta pruebas/build y cobertura diferencial, además de CodeQL para los dos lenguajes.
- `backend/pom.xml` configura Spring Boot Test y JaCoCo XML.
- `frontend/package.json` configura Vitest con cobertura V8/LCOV. `--passWithNoTests` conserva el scaffolding sin inventar pruebas de aplicación; el umbral fallará cuando se cambie código sin cobertura.
- `docker/compose.sonarqube.yml` mantiene SonarQube Community disponible para análisis local opcional. Community no forma parte del gate de PR.

## Activación del bloqueo en GitHub

El ruleset `Protect develop` aplica estas reglas en `develop`: exige Pull Request, los checks de Conventional Commits, pruebas/cobertura y CodeQL, además de bloquear hallazgos nuevos de CodeQL con severidad de seguridad High o Critical y severidad general Error. Los pushes directos se rechazan, incluso para administradores. Los PR elegibles se integran automáticamente con squash cuando no tienen conflictos y todos los requisitos se cumplen.

El workflow `auto-develop.yml` abre PRs desde las ramas personales hacia `develop`, activa auto-merge solo cuando no hay conflictos y deja que los checks requeridos decidan cuándo integrar. Si algo bloquea la integración, comenta en el PR mencionando a su responsable. Como usa `pull_request_target` para responder a PR de colaboradores con permisos de escritura, no descarga ni ejecuta el código del PR. Cada actualización de `develop` abre o actualiza un PR hacia `main`; ese PR no se fusiona automáticamente y `Protect main` exige una aprobación.

El gate de calidad sigue ejecutándose con `pull_request`, permisos mínimos de lectura para el contenido y `security-events: write` para publicar SARIF. No ejecuta código de PR con un runner propio.

## Responsabilidades

Jefferson (`jeffersonmejia`) define el alcance y los criterios. Jennifer (`Jntorres2001`) ejecuta pruebas unitarias, de integración y de rendimiento con k6 según sus tareas y los umbrales acordados; no redefine los criterios del gate. También puede revisar de forma continua el código ya implementado con análisis estático/SonarQube Community local mientras las tareas de integración o rendimiento esperan dependencias. En QA-005 registra evidencia en [`quality-templates/formato_sonar_qube.docx`](quality-templates/formato_sonar_qube.docx), genera un PDF breve con imagen, descripción, prioridad y responsable, y avisa por el grupo de WhatsApp del proyecto mencionando al responsable para que corrija sobre la marcha. Seguridad, exposición de datos y aislamiento tenant son P0; defectos críticos/altos de flujos principales P1; defectos relevantes P2; hallazgos menores P3. No se incluyen secretos ni datos reales de clientes/tenants. SonarQube ayuda a corregir sobre la marcha; no es un gate de PR. Las pruebas k6 se limitan a los flujos críticos definidos en [`testing.md`](testing.md).

## Referencias

- [Requisitos iniciales](../requerimientos_iniciales.md): los análisis y gates estaban excluidos del scaffolding inicial; esta configuración corresponde a la etapa posterior autorizada.
- [CodeQL con GitHub Actions](https://docs.github.com/en/code-security/how-tos/scan-code-for-vulnerabilities/configure-code-scanning/advanced-setup-for-code-scanning): análisis de código integrado en workflows.
- [Protección de merges con Code Scanning](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/manage-your-configuration/set-merge-protection): reglas para bloquear alertas por herramienta y severidad.
- [`diff-cover`](https://github.com/Bachmann1234/diff_cover): cobertura diferencial compatible con JaCoCo XML y LCOV.
- [SonarQube Community Build y GitHub](https://docs.sonarsource.com/sonarqube-community-build/devops-platform-integration/github-integration/introduction): Community no admite análisis de múltiples ramas ni de Pull Requests.
