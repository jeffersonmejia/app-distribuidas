# QUALITY-001 — Definir alcance de calidad para etapa posterior

Issue: [#10](https://github.com/jeffersonmejia/app-distribuidas/issues/10) · Responsable: @jeffersonmejia · Área: Calidad

## Objetivo

Definir y documentar el alcance de calidad para una etapa posterior, reutilizando la infraestructura SonarQube ya preparada. El análisis Java/TypeScript, los Quality Gates y sus workflows quedan fuera del scaffolding inicial.

## Instrucciones

1. Revisa el alcance aprobado en la Issue y las referencias del repositorio antes de modificar archivos.
2. Implementa únicamente lo necesario para cumplir los criterios de aceptación de esta tarea.
3. Mantén los cambios dentro de las rutas indicadas y coordina cualquier cambio de alcance antes de ejecutarlo.
4. Actualiza la documentación relacionada y deja evidencia verificable en la Issue o en el entregable correspondiente.

## Criterios de aceptación

- El documento distingue la infraestructura SonarQube existente de la configuración de análisis pendiente.
- El documento define el Quality Gate inicial: 80% de cobertura en código nuevo, cero bugs nuevos de severidad crítica, cero vulnerabilidades nuevas de severidad crítica y 100% de Security Hotspots revisados.
- El documento limita el bloqueo deseado del Quality Gate al código nuevo de Pull Requests hacia develop e identifica la limitación de Community Build y la verificación pendiente de su rama principal.
- No se configuran scanners, Quality Gates, cobertura ni workflows de análisis en esta tarea.

## Dependencias

- ARC-001
- ARC-002

## Rutas previstas

- `docs/quality.md`
- `docs/tasks/QUALITY-001.md`

## Seguimiento

El estado de ejecución y la evidencia de cierre se registran en la Issue y en GitHub Projects. Este instructivo describe el alcance aprobado; no reemplaza la verificación de los entregables.
