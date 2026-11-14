# FRONT-001 — Sistema de diseño global

Issue: [#3](https://github.com/jeffersonmejia/app-distribuidas/issues/3) · Responsable: Dayanara (`Dayanarablb`)

## Lógica aprobada

- `frontend/src/theme/tokens.css` es la fuente de tokens: color de marca `#A80058`, neutros, superficies semánticas, tipografía, bordes, estados, foco y radios derivados de `--radius-base`.
- Se conserva el modo oscuro por `prefers-color-scheme`; los colores de estado no dependen del color de marca.
- Los componentes reutilizables consumen estos tokens. No duplican colores o medidas con valores locales cuando exista un token semántico.
- Los estilos deben permitir los tamaños de pantalla usados por el layout y formularios del MVP, con foco visible y etiquetas accesibles.

## Alcance

Definir tokens y los componentes comunes necesarios para los flujos comprometidos por FRONT-002 y FRONT-003. No implementar pantallas de negocio ni cambiar contratos de backend.

## Verificación

Probar renderizado e interacción de los componentes que se agreguen, incluidos estados de foco, inválido y deshabilitado cuando correspondan. La interfaz actual en `src/features/identity/pages/LoginPage.tsx` sirve como referencia existente, no como API visual nueva.

## Fuentes

- `frontend/src/theme/tokens.css`
- `frontend/src/globals.css`
- `docs/tasks/FRONT-002.md`

No hay un catálogo aprobado de componentes más amplio que las necesidades de los flujos del MVP; no agregar componentes de dominio por anticipado.
