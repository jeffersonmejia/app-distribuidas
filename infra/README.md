# Infraestructura Azure — develop

Terraform modular para PostgreSQL Flexible Server en **Brazil South**, Azure Container Instances en **East US**, Azure Container Registry Basic, y GitHub Actions con Azure OIDC.

## Estado de esta preparación

- La infraestructura está preparada y se incorporará a `develop` mediante el flujo normal de Pull Request.
- Azure CLI confirmó la suscripción **Azure for Students** habilitada; GitHub CLI confirmó `jeffersonmejia` con acceso de administrador.
- Se configuraron el resource group dedicado, la identidad federada OIDC, roles limitados a ese grupo y el environment `develop` restringido a la rama `develop`.
- Se creó el secreto aleatorio de PostgreSQL localmente en `infra/.env` y se cargó con GitHub CLI sin mostrar su valor. Las credenciales de migración y runtime se generan por separado en los mismos destinos.
- No se ejecutó `terraform plan`/`apply` ni se crearon recursos de cómputo, base de datos, registry o almacenamiento que generen cargos. El state remoto aún requiere una cuenta Storage facturable.

## Qué despliega

- Frontend React compilado y servido por Nginx en ACI.
- Backend Java/Spring Boot, con pruebas desactivadas durante la compilación de imagen. El backend es opcional al ejecutar el workflow.
- Azure Container Registry Basic con identidad administrada de solo lectura para ACI y `AcrPush` para GitHub Actions.
- PostgreSQL 16, SKU Burstable B1ms, disco mínimo de 32 GiB, retención de backup de 7 días, sin alta disponibilidad ni crecimiento automático.

El frontend actual renderiza un elemento vacío en `App.tsx`, así que la URL pública responderá pero la pantalla todavía no tiene contenido. El backend requiere `AUTH_ISSUER_URI` y `AUTH_AUDIENCE`; esos valores no están definidos en el `.env` disponible. No se inventan ni se configura una identidad externa.

## Costos aproximados

Con ACI encendido 24/7, 1 vCPU y entre 1 y 1.5 GiB, PostgreSQL B1ms/32 GiB, ACR Basic y el state remoto:

| Recurso | Aproximación al mes |
| --- | ---: |
| ACI Linux | US$39–42 |
| PostgreSQL B1ms + disco/backups | US$16–21 |
| ACR Basic | alrededor de US$5 |
| Storage del state, LRS | bajo, facturable |
| **Total de referencia** | **aprox. US$60–75** |

La tarifa publicada de ACI Linux es por vCPU-segundo y GiB-segundo; la página de PostgreSQL lista B1ms alrededor de US$12.41/mes de cómputo antes del disco. Son referencias, no una cotización para Brazil South ni una garantía de que el crédito alcance. Comprueba [ACI](https://azure.microsoft.com/en-us/pricing/details/container-instances/), [PostgreSQL Flexible Server](https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/) y [ACR](https://azure.microsoft.com/en-us/pricing/details/container-registry/) antes del primer despliegue.

US$100 cubrirían aproximadamente **1–1.5 meses** con todo encendido, antes de egreso, impuestos y otros recursos de la suscripción. ACI factura mientras corre. PostgreSQL deja de cobrar cómputo cuando se detiene, pero conserva disco/backup y se reactiva automáticamente después de 7 días detenidos ([documentación](https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/how-to-stop-server)).

## Red y backend opcional

PostgreSQL no crea reglas de firewall si el backend está desactivado, por lo que no acepta conexiones externas. ACI público no ofrece una IP de salida fija; para el backend, el workflow exige que selecciones `allow_azure_services_postgres`. Eso crea la regla Azure `0.0.0.0`, que permite conexiones desde cualquier servicio Azure, incluso suscripciones de otras personas. Microsoft documenta ese alcance en [reglas de firewall de PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/security/security-firewall-rules). Déjala desactivada hasta que necesites desplegar el backend y comprendas ese alcance.

Al activar el backend, el workflow comprueba issuer/audience y contraseñas separadas. Crea roles `erp_migrator` y `erp_runtime_login` como indica `docs/tenancy-operacion.md`, usando una regla temporal que permite únicamente la IP del runner GitHub; un `trap` intenta quitarla al terminar.

## Preparar GitHub y Terraform

El grupo de recursos y la identidad OIDC ya se prepararon sin crear recursos facturables. Para volver a confirmar las sesiones:

```powershell
az login
az account set --subscription "Azure for Students"
az account show --query "{subscription:name,id:id,state:state}" --output table
gh auth login
gh auth status
```

La GitHub App `app-distribuidas-auto-develop` se instala solo en este repositorio. Para crear PRs, comentar bloqueos y activar auto-merge en PRs que modifican workflows, requiere permisos de repositorio **Checks: read**, **Commit statuses: read**, **Contents: read/write**, **Issues: read/write**, **Pull requests: read/write** y **Workflows: read/write**. GitHub debe aprobar los permisos nuevos de `Contents` y `Workflows` en la instalación antes de que el flujo pueda integrar PRs con cambios bajo `.github/workflows/`.

Genera tres contraseñas aleatorias independientes, crea `infra/.env` desde el ejemplo y carga los valores sin imprimirlos:

```powershell
Copy-Item infra/.env.example infra/.env
$bytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$password1 = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$password2 = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$password3 = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
$envText = "POSTGRES_ADMIN_PASSWORD=$password1`nDB_RUNTIME_PASSWORD=$password2`nDB_MIGRATION_PASSWORD=$password3`n"
Set-Content infra/.env -Value $envText -NoNewline -Encoding ascii
Remove-Variable bytes,password1,password2,password3,envText
.\infra\scripts\set-github-secrets.ps1
```

Cuando tengas el proveedor de identidad configurado, agrega `AUTH_ISSUER_URI` y `AUTH_AUDIENCE` a `infra/.env` y vuelve a ejecutar el script. Esos dos valores se guardan como variables de GitHub Actions, no como secretos.

El state persistente usa un Azure Storage Account privado. Después de revisar su costo, ejecútalo una sola vez:

```powershell
.\infra\scripts\bootstrap-state.ps1
```

Este paso crea el recurso facturable más pequeño de la preparación y asigna `Storage Blob Data Contributor` a GitHub OIDC sobre esa cuenta únicamente.

## Desplegar

Al incorporar cambios de `infra/`, `backend/`, `frontend/`, los archivos de dependencias o el propio workflow a `develop`, GitHub Actions ejecuta `terraform plan` y aplica automáticamente el plan. Terraform crea o actualiza únicamente los recursos cuya configuración cambió. Los cambios solo de documentación no inician el deployment. El backend de la aplicación y su regla amplia de firewall permanecen desactivados automáticamente.

Para revisar sin aplicar, usa **Actions → Deploy develop to Azure → Run workflow** y elige `plan`. La opción manual `deploy` también construye y publica imágenes; puede generar cargos.

En ejecución automática:

- Se construye y publica la imagen frontend.
- Se calcula el plan de Terraform y se aplica solo si el plan muestra cambios.
- No se construye la imagen backend ni se habilitan sus recursos mientras `enable_backend` siga desactivado.

En una ejecución manual de **Actions → Deploy develop to Azure → Run workflow**:

- `plan`: muestra cambios, no los aplica.
- `deploy`: crea o actualiza los recursos definidos, publica imágenes y aplica el plan; puede generar cargos.
- `enable_backend` empieza desactivado. Actívalo solo después de cargar issuer, audience y secretos de roles.
- `allow_azure_services_postgres` también empieza desactivado. Para activar el backend debes aceptar explícitamente la regla de red amplia descrita arriba.

Antes de la primera ejecución automática debe crearse el backend remoto de estado con `infra/scripts/bootstrap-state.ps1`; ese almacenamiento tiene un costo bajo. El workflow no ejecuta las pruebas del proyecto. La compilación Java omite compilación/ejecución de pruebas con `-Dmaven.test.skip=true`; el build React solo compila los recursos.
