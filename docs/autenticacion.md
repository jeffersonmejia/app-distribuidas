# AUTH-001 — Autenticación y permisos

## Decisión del MVP

- La API recibe access tokens `Bearer` JWT emitidos por un proveedor externo compatible con OpenID Connect. El backend actúa como OAuth 2.0 Resource Server; no emite tokens, no almacena contraseñas y no implementa login ni renovación de credenciales.
- El token debe tener firma válida y claims `iss`, `exp`, `nbf`, `aud` y `sub` válidos. `sub` es el UUID estable del actor. El issuer y audience permitidos se configuran por entorno; no hay valores de producción ni secretos en el repositorio.
- El cliente envía el tenant solicitado en `X-Tenant-ID`. Es un selector UUID no confiable, nunca autorización. No se acepta `actor_id`, permisos ni roles del cuerpo, query, headers adicionales o claims del token como fuente de permisos.
- Los permisos son códigos explícitos asociados a la membresía activa del actor en el tenant seleccionado. No hay roles globales ni herencia implícita en el MVP. Cada caso de uso declara el permiso requerido y `tenancy` comprueba la membresía y ese permiso antes de exponer datos tenant-scoped.

## Ciclo y rechazo

El proveedor autentica al usuario y emite un access token firmado. El cliente lo envía en cada solicitud protegida; el backend valida firma, issuer, audiencia y vigencia y obtiene el actor exclusivamente de `sub`. La revocación de credenciales y la emisión/renovación de tokens pertenecen al proveedor. El backend rechaza token ausente o inválido con `401`; rechaza tenant ausente/malformado, membresía ausente o revocada, y permiso insuficiente con `403` (sin revelar si existe otro tenant o membresía). No consulta datos de negocio antes de autorizar.

El backend no registra el bearer token, su firma ni credenciales. Las respuestas de error son genéricas y no contienen claims, secretos, consultas, stack traces ni detalles de membresía.

La protección CSRF de Spring Security permanece habilitada. El JWT se recibe solo en la cabecera `Authorization: Bearer` y no se guarda en cookies; el navegador no adjunta esa cabecera automáticamente a solicitudes de otro sitio. Si futuras rutas usan autenticación con cookies o sesiones, deben exigir y validar token CSRF. No desactivar CSRF globalmente.

## Configuración operativa

Configurar `AUTH_ISSUER_URI` y `AUTH_AUDIENCE` por entorno mediante el gestor de configuración/secrets de despliegue. Si faltan o no corresponden al proveedor configurado, el servicio no debe aceptar solicitudes autenticadas. Solo transportar tokens por TLS; los clientes mantienen y renuevan tokens según las reglas del proveedor. El backend no escribe tokens en cookies ni en almacenamiento propio.

## Extensiones fuera de esta decisión

Este contrato no define un proveedor concreto, login de usuario, registro/provisión de tenants, permisos de negocio ni mecanismos de soporte multi-tenant. Esas decisiones requieren alcance aprobado antes de exponer endpoints o políticas adicionales.

## Referencias

- [Spring Security — OAuth 2.0 Resource Server JWT](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html)
- [OWASP — REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
