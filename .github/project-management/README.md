# Administración del proyecto desde VS Code

La configuración del tablero está en `project.yml` y la lista editable de tareas está en `tasks.yml`. Ambos archivos usan sintaxis JSON, que también es YAML válido; así el script puede leerlos con PowerShell incluido en Windows 11 sin instalar módulos.

## Requisitos y acceso

- GitHub CLI (`gh`) autenticado con la cuenta propietaria del proyecto.
- Acceso de escritura al repositorio para crear y asignar Issues.
- Scopes `repo` y `project` en la sesión de `gh` para Issues y GitHub Projects V2.
- Para asignar una persona, su login debe existir y tener permiso de escritura en el repositorio. Las cuentas que no cumplan esto quedan sin asignar.

Comprueba el acceso con:

```powershell
gh auth status
gh repo view --json nameWithOwner,owner,viewerPermission
```

No guardes tokens en estos archivos. Si falta autorización, el modo `-Apply` se detiene antes de cualquier cambio remoto.

## Sincronizar

Desde la raíz del repositorio, en PowerShell:

```powershell
.\.github\project-management\sync-project.ps1
.\.github\project-management\sync-project.ps1 -Apply
```

La primera forma es una simulación: lee GitHub para detectar proyecto, Issues duplicados y asignaciones, pero no escribe. La segunda muestra el resumen y aplica solo tareas administradas en `tasks.yml`. Los identificadores permanentes se guardan en el cuerpo de cada Issue y el número asociado se persiste en el YAML. El script no borra ni cierra Issues.

Si un Issue o sus campos del proyecto difieren de la última instantánea registrada en `tasks.yml`, el script informa el conflicto y omite esa tarea para no sobrescribir ediciones hechas directamente en GitHub. Edita `tasks.yml` para proponer cambios. Si aceptas una edición manual de GitHub, actualiza los valores correspondientes en YAML y deja `syncFingerprint` en `null`; la siguiente aplicación solo la adoptará si ambos lados coinciden.

## Tablero y vistas

El proyecto se crea bajo el propietario detectado desde el repositorio, o se reutiliza si ya existe uno con el título exacto **ERP + CRM Multitenant**. Se vincula al repositorio y se aseguran los campos Estado, Prioridad, Área, Identificador de tarea, Fecha objetivo y Fecha de completado. Las tareas nuevas empiezan en **Pendiente**; no hay fechas objetivo inventadas. Las tareas completadas registran su fecha en **Fecha de completado**, sin sustituir la fecha objetivo.

El script crea las vistas Kanban y Tabla mediante la API GraphQL de GitHub Projects V2. Las tareas tienen como fecha objetivo el 15 de noviembre de 2026. Después de la primera sincronización, en GitHub configura la vista Kanban para agrupar por **Estado** y ajusta las columnas visibles de la tabla:

1. En **Kanban**, elige agrupar por el campo **Estado**.
2. En **Tabla**, muestra identificador, título, estado, prioridad, área, responsables y fecha objetivo.

La sincronización crea relaciones `blocked by` según `dependencies`. Mantén las dependencias dirigidas desde el trabajo dependiente hacia sus prerrequisitos; el script rechaza ciclos y referencias a identificadores inexistentes.

## Asignaciones iniciales verificadas

- Jefferson se resuelve como `jeffersonmejia`, propietario autenticado y administrador del repositorio.
- Sahid (`Sahid-B`), Dayanara (`Dayanarablb`) y Esteban (`EMLarco`) tienen acceso de escritura y pueden asignarse.
- El login proporcionado para Bruce (`bruce_rodriguez05`) no existe; no se sustituye por una cuenta de nombre parecido.
- Jennifer (`Jntorres2001`) existe, pero tiene permiso de solo lectura; sus tareas quedan sin asignar.

Corrige el login o los permisos en `tasks.yml`/GitHub cuando corresponda. La automatización no modifica Issues ajenos ni concede accesos.
