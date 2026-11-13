# QUALITY-001 — Gate gratuito de calidad

## Alcance aprobado

El gate se ejecuta en Pull Requests dirigidos a `develop` y al actualizar esa rama. No requiere SonarQube Server, SonarQube Cloud, una licencia ni secretos externos.

- La cobertura de las líneas de código fuente nuevas o modificadas debe ser al menos **80%**.
- CodeQL analiza Java/Kotlin y JavaScript/TypeScript con las consultas `security-extended`.
- GitHub debe bloquear alertas nuevas de seguridad **High o Critical**, y alertas de calidad de severidad **Error**.
- Los hallazgos de seguridad restantes deben revisarse manualmente en GitHub antes de integrar el PR.
- Duplicación y code smells no bloquean esta etapa.

La cobertura diferencial se calcula con JaCoCo XML y LCOV usando `diff-cover`; esto permite aplicar el umbral a líneas cambiadas sin depender de un servidor de análisis. Los cambios que no tocan código cubierto no consumen el umbral.

## Configuración del repositorio

- `.github/workflows/quality-gate.yml` ejecuta pruebas/build y cobertura diferencial, además de CodeQL para los dos lenguajes.
- `backend/pom.xml` configura Spring Boot Test y JaCoCo XML.
- `frontend/package.json` configura Vitest con cobertura V8/LCOV. `--passWithNoTests` conserva el scaffolding sin inventar pruebas de aplicación; el umbral fallará cuando se cambie código sin cobertura.
- `docker/compose.sonarqube.yml` mantiene SonarQube Community disponible para análisis local opcional. Community no forma parte del gate de PR.

## Activación del bloqueo en GitHub

El workflow informa los análisis, pero **no bloquea merges por sí solo** hasta activar las reglas del repositorio. Después de publicar el workflow en una rama, ejecutar al menos un análisis de CodeQL exitoso y confirmar el nombre del check:

1. Crear un ruleset de rama dirigido a `develop`.
2. Exigir los checks `Tests and 80% changed-code coverage` y los dos checks `CodeQL (java-kotlin)` y `CodeQL (javascript-typescript)`.
3. En `Require code scanning results`, seleccionar `CodeQL`, bloquear alertas de seguridad `High or higher` y alertas generales `Errors`.
4. Confirmar que un PR de prueba hacia `develop` muestra cobertura diferencial y resultados de CodeQL antes de considerar activo el bloqueo.

El workflow usa `pull_request`, permisos mínimos de lectura para el contenido y permisos `security-events: write` para publicar SARIF. No usa `pull_request_target` ni ejecuta código de PR con un runner propio.

## Responsabilidades

Jefferson (`jeffersonmejia`) define el alcance y los criterios. Jennifer (`Jntorres2001`) ejecuta pruebas unitarias, de integración y de rendimiento con k6 según sus tareas y los umbrales acordados; no redefine los criterios del gate. Las pruebas k6 se limitan a los flujos críticos definidos en [`testing.md`](testing.md).

## Referencias

- [Requisitos iniciales](../requerimientos_iniciales.md): los análisis y gates estaban excluidos del scaffolding inicial; esta configuración corresponde a la etapa posterior autorizada.
- [CodeQL con GitHub Actions](https://docs.github.com/en/code-security/how-tos/scan-code-for-vulnerabilities/configure-code-scanning/advanced-setup-for-code-scanning): análisis de código integrado en workflows.
- [Protección de merges con Code Scanning](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/manage-your-configuration/set-merge-protection): reglas para bloquear alertas por herramienta y severidad.
- [`diff-cover`](https://github.com/Bachmann1234/diff_cover): cobertura diferencial compatible con JaCoCo XML y LCOV.
- [SonarQube Community Build y GitHub](https://docs.sonarsource.com/sonarqube-community-build/devops-platform-integration/github-integration/introduction): Community no admite análisis de múltiples ramas ni de Pull Requests.
