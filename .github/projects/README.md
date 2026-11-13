# GitHub Projects como código

Sincronización manual entre Issues de **ERP + CRM Multitenant**, archivos YAML por tarea y GitHub Projects V2. No usa Actions, webhooks ni servicios. `Status`, `Estado` y el estado abierto/cerrado del Issue son propiedades independientes.

## Requisitos y configuración

- Windows 11, Python 3.12 o compatible y [GitHub CLI](https://cli.github.com/).
- En la raíz del repositorio, instalar dependencias: `python -m pip install -r .github/projects/sync/requirements.txt`.
- Autenticar con `gh auth login`; para acceso a Projects, ejecutar `gh auth refresh -s project`.
- Revisar `.github/projects/config.yaml`. El Project se descubre por propietario y nombre; su número e ID no se presuponen.

## Uso

Desde PowerShell, en la raíz del repositorio:

```powershell
python .github/projects/sync/cli.py schema refresh
python .github/projects/sync/cli.py init
python .github/projects/sync/cli.py plan
python .github/projects/sync/cli.py plan --task ARC-001 --json
python .github/projects/sync/cli.py pull --task ARC-001
python .github/projects/sync/cli.py push --task ARC-001
python .github/projects/sync/cli.py sync --dry-run
python .github/projects/sync/cli.py sync
```

`init` importa Issues como `.github/projects/tasks/<ID>.yaml`, sin sobrescribir archivos existentes ni editar GitHub. También conserva la información de planificación del antiguo `.github/project-management/tasks.yml`. `plan` y `sync --dry-run` no escriben YAML ni SQLite. Pull, push y sync consultan el esquema remoto antes de planificar; las escrituras ocurren únicamente al invocar esos comandos explícitamente. No se eliminan Issues ni se cierran/abren automáticamente.

Editar `issue` para título, Markdown, responsables y etiquetas; editar `project` usando los nombres de campo exactos presentes en `schema.yaml`. Los IDs se descubren al actualizar el esquema. Los campos u opciones incompatibles se conservan y no se escriben. Una tarea individual se puede cargar en Python sin leer los demás YAML.

## Conflictos y colaboración

Los cambios se comparan propiedad por propiedad con la última base correcta de `.github/projects/.cache/sync.sqlite3`. Si SQLite falta, las diferencias simultáneas se registran como conflicto; no se elige automáticamente el último cambio. Revisar `conflicts` y resolver cada propiedad explícitamente:

```powershell
python .github/projects/sync/cli.py conflicts --task ARC-001
python .github/projects/sync/cli.py resolve --task ARC-001 --property issue.title --use local
python .github/projects/sync/cli.py sync --task ARC-001
```

Versionar YAML y `schema.yaml`; SQLite y temporales están ignorados. Use una rama Git por cambio y revise el diff antes de sincronizar. El bloqueo local evita dos comandos de escritura simultáneos en la misma copia; no coordina bases SQLite distintas entre computadoras.

## Limitaciones

- Las pruebas usan mocks y no escriben en GitHub. `schema refresh` e `init` consultan GitHub, pero no mutan Issues ni Projects.
- El estado abierto/cerrado del Issue es de solo lectura; se importa para conservarlo.
- Un Issue eliminado no se recrea automáticamente. Draft Issues se descubren, pero no se convierten ni exportan como Issues.
- Solo se escriben tipos de campo que la API soporta de forma segura (texto, fecha, número y selección). Campos desconocidos permanecen intactos.
- La inicialización no fusiona datos remotos sobre YAML ya existente.
