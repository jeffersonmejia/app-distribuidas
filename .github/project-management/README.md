# Gestión del GitHub Project

La sincronización vigente usa [`.github/projects`](../projects/README.md) y archivos YAML individuales en `.github/projects/tasks/`.

`.github/project-management/tasks.yml` y `project.yml` se conservan como referencia de migración. El antiguo sincronizador PowerShell fue retirado para evitar que una segunda herramienta altere campos o estados del Project.

Usa desde la raíz del repositorio:

```powershell
python .github/projects/sync/cli.py plan
python .github/projects/sync/cli.py sync --dry-run
python .github/projects/sync/cli.py sync
```
