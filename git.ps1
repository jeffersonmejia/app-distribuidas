$ErrorActionPreference = 'Stop'

function Stop-WithMessage([string]$Message) {
    Write-Error $Message
    exit 1
}

$branch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
    Stop-WithMessage 'No se pudo determinar la rama activa.'
}

$personalBranches = @('Bruce', 'Dayanara', 'Esteban', 'Jefferson', 'Jennifer', 'Sahid')
if ($branch -notin $personalBranches) {
    Stop-WithMessage "La sincronización requiere una rama personal; rama activa: '$branch'."
}

if (git status --porcelain) {
    Stop-WithMessage 'El árbol de trabajo tiene cambios. Consérvalos y deja la rama limpia antes de sincronizar.'
}

git fetch origin
if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage 'Falló git fetch origin; no se modificó la rama local.'
}

$remoteBranch = "origin/$branch"
git show-ref --verify --quiet "refs/remotes/$remoteBranch"
if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "No existe la rama remota '$remoteBranch'; no se publicará una rama nueva."
}

$ahead = [int](git rev-list --count "$remoteBranch..HEAD")
if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "No se pudo comparar la rama local con '$remoteBranch'."
}
if ($ahead -gt 0) {
    Stop-WithMessage "La rama local tiene $ahead commit(s) no publicados frente a '$remoteBranch'. Publícalos o resuelve la diferencia antes de sincronizar."
}

git merge --ff-only $remoteBranch
if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "No se pudo avanzar de forma segura hasta '$remoteBranch'. No se modificó ningún historial remoto."
}

git merge --no-edit origin/develop
if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage 'Falló el merge de origin/develop. Revisa los conflictos antes de continuar; el script no los resolverá.'
}

$behind = [int](git rev-list --count "HEAD..$remoteBranch")
if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "No se pudo comparar la rama local con '$remoteBranch' después del merge."
}
if ($behind -gt 0) {
    Stop-WithMessage "'$remoteBranch' avanzó durante la sincronización. No se hizo push; vuelve a revisar el estado y sincroniza manualmente."
}

$aheadAfterMerge = [int](git rev-list --count "$remoteBranch..HEAD")
if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "No se pudo verificar el resultado frente a '$remoteBranch'."
}
if ($aheadAfterMerge -gt 0) {
    git push origin $branch
    if ($LASTEXITCODE -ne 0) {
        Stop-WithMessage "Falló el push a '$remoteBranch'; revisa el estado antes de reintentar."
    }
    Write-Host "Sincronización completada y publicada en '$remoteBranch'."
} else {
    Write-Host "'$branch' ya estaba sincronizada con origin/develop. No se creó ni publicó ningún commit."
}
