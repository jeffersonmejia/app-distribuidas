# FRONT-003 — Interfaz de clientes y sesión

Issue: [#33](https://github.com/jeffersonmejia/app-distribuidas/issues/33) · Responsable: Dayanara (`Dayanarablb`)

## Lógica

- Mostrar la sesión autenticada y permitir elegir un tenant al que el usuario ya pertenece.
- El selector de tenant solo aporta el identificador de contexto a la solicitud. No concede acceso: backend valida actor, membresía activa y permiso.
- CRM consume `/api/v1/crm/customers` según `docs/crm/requerimientos.md`; listados no superan 5 elementos y muestran carga, vacío y error.
- Errores no exponen SQL, stack traces, credenciales ni datos de otro tenant.

## Límite de autenticación

El backend actual es OAuth2 Resource Server y valida bearer JWT, pero no expone un endpoint de login ni define proveedor, issuer o audience para la UI. `LoginPage.tsx` muestra explícitamente que el proveedor no está configurado y no envía las credenciales. No guardar ni enviar contraseña a un endpoint inventado. Integrar login real solo cuando se apruebe/configure el proveedor y su flujo.

## Dependencias

FRONT-001/002 y contratos de identidad, tenancy y CRM. CRM-001 está completada, por lo que ya no es bloqueo.
