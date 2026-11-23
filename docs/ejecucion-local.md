# Ejecución local y recuperación — OPS-002

Esta guía parte de una copia limpia y usa PowerShell desde la raíz del repositorio. No despliega recursos en Azure ni necesita datos de clientes.

## Requisitos

- Git, Java 21 con `JAVA_HOME` apuntando al JDK 21 y Maven 3.9.
- Node.js 24 y npm; es la versión usada por el workflow de calidad.
- Docker Desktop con Compose y su motor Linux activo. Testcontainers necesita acceso al motor.
- Conexión a los registros de paquetes e imágenes la primera vez. Las etiquetas de imágenes de Compose son mutables; para repetir exactamente una ejecución conserva también las versiones o digests usados.
- Para ejecutar el backend con autenticación real: un proveedor OIDC accesible, issuer y audiencia configurados, token de prueba y una membresía autorizada. El repositorio no incluye un proveedor de identidad.

Comprueba herramientas sin mostrar secretos:

```powershell
git --version
java -version
mvn --version
node --version
npm --version
docker compose version
docker info --format '{{.ServerVersion}}'
```

Si `mvn --version` muestra otro Java aunque `java -version` indique 21, corrige `JAVA_HOME` para esa terminal. No es necesario ejecutar Terraform para desarrollo local.

## PostgreSQL local y roles

En la raíz, crea el archivo local solo si no existe y edítalo para sustituir las contraseñas de ejemplo por valores independientes:

```powershell
if (-not (Test-Path docker/.env)) { Copy-Item docker/.env.example docker/.env }
notepad docker/.env
docker compose --env-file docker/.env -f docker/compose.yml config --quiet
docker compose --env-file docker/.env -f docker/compose.yml up -d --wait --wait-timeout 180
docker compose --env-file docker/.env -f docker/compose.yml ps
```

El servicio `postgres` debe aparecer `healthy` y escucha solo en `127.0.0.1:5432`. Si el puerto está ocupado, identifica su proceso o contenedor antes de actuar; no detengas servicios ajenos. El volumen `erp_postgres_data` persiste los datos.

La primera vez, crea los roles con la cuenta administradora del contenedor. El script existente es idempotente para roles y contraseñas. Pide dos contraseñas distintas con el diálogo seguro y no imprimas los valores:

```powershell
$opsRuntime = Get-Credential -UserName 'erp_runtime_login' -Message 'Contraseña local de runtime'
$opsMigrator = Get-Credential -UserName 'erp_migrator' -Message 'Contraseña local de migraciones'
$env:DB_RUNTIME_PASSWORD = $opsRuntime.GetNetworkCredential().Password
$env:DB_MIGRATION_PASSWORD = $opsMigrator.GetNetworkCredential().Password
$env:DB_RUNTIME_USER = 'erp_runtime_login'
$env:DB_MIGRATION_USER = 'erp_migrator'
Get-Content -Raw infra/scripts/bootstrap-db-roles.sql | docker compose --env-file docker/.env -f docker/compose.yml exec -T -e DB_RUNTIME_PASSWORD -e DB_MIGRATION_PASSWORD postgres sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -'
```

Configura las URL para la base indicada en `docker/.env`. Con el nombre del ejemplo:

```powershell
$env:DB_RUNTIME_URL = 'jdbc:postgresql://localhost:5432/erp_crm'
$env:DB_MIGRATION_URL = 'jdbc:postgresql://localhost:5432/erp_crm'
$env:AUTH_ISSUER_URI = Read-Host 'Issuer OIDC del entorno de prueba'
$env:AUTH_AUDIENCE = Read-Host 'Audiencia JWT del entorno de prueba'
mvn -B -ntp -f backend/pom.xml spring-boot:run '-Dspring-boot.run.profiles=dev'
```

Flyway usa el migrador; la aplicación usa `erp_runtime_login`, que no es dueña ni superusuario y no tiene `BYPASSRLS`. Una base nueva también requiere la provisión administrativa y auditada del tenant y su primera membresía: sigue [operación de tenancy](tenancy-operacion.md). Sin issuer, token o membresía válidos no se puede comprobar un flujo autenticado. El perfil `dev` habilita Swagger y es solo local.

Las variables anteriores viven en la terminal actual y deben configurarse de nuevo en otra. Al terminar, limpia las contraseñas de esa terminal:

```powershell
Remove-Item Env:DB_RUNTIME_PASSWORD, Env:DB_MIGRATION_PASSWORD -ErrorAction SilentlyContinue
Remove-Variable opsRuntime, opsMigrator -ErrorAction SilentlyContinue
```

## Frontend y verificaciones

En otra terminal PowerShell, desde la raíz:

```powershell
npm --prefix frontend ci
npm --prefix frontend run build
npm --prefix frontend run test:coverage
npm --prefix frontend run lint
npm --prefix frontend run dev
```

Por defecto `VITE_DATA_SOURCE=mock`: la interfaz usa datos simulados y puede abrirse sin backend. Para `api`, configura `frontend/.env.local` a partir de `frontend/.env.example`, un token de prueba de corta duración y un tenant autorizado. Las variables `VITE_*` se entregan al navegador: nunca pongas secretos permanentes o de producción. La sesión actual usa un repositorio simulado; no se ofrece login OIDC completo. Vite no configura un proxy de API en este repositorio, por lo que conectar dos orígenes requiere una configuración de red/CORS o proxy aprobada; no se garantiza el flujo integrado con los valores por defecto.

Ejecuta las pruebas del backend desde la raíz, con Docker disponible:

```powershell
mvn -B -ntp -f backend/pom.xml verify
```

Revisa el resumen de pruebas y si hay omisiones: una compilación de imagen no sustituye estas pruebas. El Quality Gate y sus umbrales se describen en [quality.md](quality.md).

## SonarQube local opcional

```powershell
docker compose --env-file docker/.env -f docker/compose.sonarqube.yml config --quiet
docker compose --env-file docker/.env -f docker/compose.sonarqube.yml up -d --wait --wait-timeout 360
docker compose --env-file docker/.env -f docker/compose.sonarqube.yml ps
(Invoke-RestMethod http://127.0.0.1:9000/api/system/status).status
```

La API debe responder `UP`; `STARTING` no indica disponibilidad. El límite configurado es 3 GiB/2 CPU para SonarQube y 1 GiB/0,5 CPU para su PostgreSQL, además de los demás servicios. Comprueba memoria, disco y los [requisitos Linux de SonarQube Community](https://docs.sonarsource.com/sonarqube-community-build/server-installation/pre-installation/linux), incluidos `vm.max_map_count`, archivos y procesos; en Docker Desktop se aplican al entorno Linux. SonarQube es opcional y no es el gate del PR.

## Recuperación local

Reiniciar o recrear contenedores con `up -d` conserva los volúmenes. Usa `ps` y `logs --tail 100 <servicio>` con el mismo archivo Compose para diagnosticar; revisa los logs antes de compartirlos. No ejecutes `down -v` ni elimines volúmenes para corregir un error: borrarían datos.

Para una copia de respaldo local, detén las escrituras o coordina una ventana consistente y protege el archivo resultante, pues contiene datos:

```powershell
docker compose --env-file docker/.env -f docker/compose.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/erp-backup.dump'
$opsBackupPath = Join-Path $env:USERPROFILE 'erp-backup.dump'
docker compose --env-file docker/.env -f docker/compose.yml cp postgres:/tmp/erp-backup.dump $opsBackupPath
```

Verifica periódicamente la restauración en una **base nueva y aislada**, con los roles requeridos ya preparados; el siguiente ejemplo no reemplaza la base activa:

```powershell
docker compose --env-file docker/.env -f docker/compose.yml exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" erp_restore_verify'
docker compose --env-file docker/.env -f docker/compose.yml cp $opsBackupPath postgres:/tmp/erp-backup.dump
docker compose --env-file docker/.env -f docker/compose.yml exec -T postgres sh -c 'pg_restore --exit-on-error -U "$POSTGRES_USER" -d erp_restore_verify /tmp/erp-backup.dump'
```

Si `erp_restore_verify` ya existe, usa otra base vacía; no la sobrescribas. `$opsBackupPath` debe apuntar al archivo protegido si utilizas otra terminal. El respaldo de una base no incluye los roles globales: restáuralos por el procedimiento operacional sin publicar credenciales. Comprueba propietarios, permisos, RLS, migraciones y datos antes de considerar la recuperación; reemplazar una base existente requiere una decisión operacional explícita. El respaldo también queda temporalmente en `/tmp` del contenedor: retíralo de forma segura al terminar. No guardes el respaldo en Git.

Las variables `POSTGRES_*` de la imagen inicializan un volumen vacío: cambiarlas después no rota la contraseña de un volumen existente. Para rotación o restauración de roles, consulta [operación de tenancy](tenancy-operacion.md).

## Azure existente

El despliegue existente usa Terraform en `infra/` para Azure PostgreSQL Flexible Server, ACI y ACR, con identidad federada OIDC en GitHub Actions. Sigue [infra/README.md](../infra/README.md) y revisa los parámetros y la suscripción antes de operar. El bootstrap del state remoto crea almacenamiento facturable: revisa costos antes de ejecutarlo. Un `terraform plan` muestra cambios propuestos; `terraform apply` modifica recursos y puede generar cargos. Esta guía local no ejecuta ninguno.

El workflow `deploy-develop.yml` puede aplicar cambios al actualizar `develop` cuando coinciden sus rutas configuradas; el modo manual `plan` es de revisión. El backend y el firewall amplio de servicios Azure son opciones separadas y requieren configuración explícita. Los Dockerfiles compilan imágenes, pero el backend omite las pruebas y el build de frontend no ejecuta Vitest. No se presupone que un recurso Azure exista o esté desplegado solo porque el Terraform esté en Git.

En ejecuciones automáticas por `push`, el workflow fija `enable_backend` y `allow_azure_services_postgres` en `false`. Si anteriormente se habilitaron mediante un despliegue manual, el siguiente `apply` automático puede proponer deshabilitarlos; revisa el estado y el plan con el equipo responsable antes de integrar cambios que activen ese workflow.
