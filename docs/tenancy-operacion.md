# Operación de roles de tenancy

La primera instalación requiere que el administrador de PostgreSQL cree los roles antes de ejecutar Flyway. No usar `postgres` ni el usuario migrador como credenciales de la aplicación.

```sql
CREATE ROLE erp_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE erp_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT USAGE, CREATE ON SCHEMA public TO erp_migrator;
ALTER DEFAULT PRIVILEGES FOR ROLE erp_migrator IN SCHEMA public
    GRANT SELECT ON TABLES TO erp_runtime;
```

La cuenta de conexión runtime se crea por el gestor de secretos/operación y recibe `GRANT erp_runtime TO <cuenta_runtime>`. Configurar `DB_RUNTIME_URL`, `DB_RUNTIME_USER` y `DB_RUNTIME_PASSWORD` para esa cuenta; configurar `DB_MIGRATION_URL`, `DB_MIGRATION_USER` y `DB_MIGRATION_PASSWORD` para `erp_migrator`. Los valores secretos no se guardan en el repositorio. El rol migrador es dueño de los objetos que crea; no se concede como miembro a la cuenta runtime.

Antes de habilitar tráfico, la provisión operacional crea cada fila inicial de `tenant` y su primera membresía con UUIDs y permisos aprobados, usando una identidad administrativa separada. Esa operación no se expone por HTTP y debe quedar auditada. Después, `TenantMembershipAdministration` permite conceder, actualizar y revocar membresías a un actor distinto, solo cuando quien ejecuta tiene el permiso `tenancy:membership:manage` en el tenant activo. `TenantLifecycleAdministration` permite suspender y reactivar el tenant con `tenancy:tenant:manage`; una membresía suspendida conserva esos permisos administrativos para permitir la reactivación. La cuenta runtime opera bajo contexto y permiso local a la transacción; las futuras migraciones de features deben conceder el DML mínimo requerido por su contrato y añadir sus políticas RLS `USING`/`WITH CHECK`.
