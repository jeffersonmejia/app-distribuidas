$ErrorActionPreference = 'Stop'

$PersonalBranches = @('Bruce', 'Dayanara', 'Esteban', 'Jefferson', 'Jennifer', 'Sahid')

function Write-Status {
    param(
        [Parameter(Mandatory)]
        [string]$Message,

        [ValidateSet('Info', 'Success', 'Warning', 'Error')]
        [string]$Level = 'Info'
    )

    $color = switch ($Level) {
        'Success' { 'Green' }
        'Warning' { 'Yellow' }
        'Error' { 'Red' }
        default { 'Cyan' }
    }

    Write-Host $Message -ForegroundColor $color
}

function Invoke-Git {
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments,

        [switch]$Quiet
    )

    $output = & git @Arguments 2>&1
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        $details = ($output | Out-String).Trim()
        $command = $Arguments -join ' '
        throw "git $command falló (código $exitCode). $details"
    }

    if (-not $Quiet -and $output) {
        $output | ForEach-Object { Write-Host $_ }
    }

    return ($output -join [Environment]::NewLine).Trim()
}

function Get-CurrentBranch {
    return Invoke-Git -Arguments @('branch', '--show-current') -Quiet
}

function Assert-SyncPreconditions {
    param([Parameter(Mandatory)][string]$Branch)

    if ($Branch -notin $PersonalBranches) {
        throw "La sincronización requiere una rama personal existente. Rama activa: '$Branch'."
    }

    $changes = Invoke-Git -Arguments @('status', '--porcelain') -Quiet
    if (-not [string]::IsNullOrWhiteSpace($changes)) {
        throw 'El árbol de trabajo tiene cambios. Consérvalos y deja la rama limpia antes de sincronizar.'
    }

}

function Assert-RemoteBranch {
    param([Parameter(Mandatory)][string]$Branch)

    $remoteBranch = "origin/$Branch"
    Invoke-Git -Arguments @('show-ref', '--verify', '--quiet', "refs/remotes/$remoteBranch") -Quiet | Out-Null
    $ahead = [int](Invoke-Git -Arguments @('rev-list', '--count', "$remoteBranch..HEAD") -Quiet)
    if ($ahead -gt 0) {
        throw "La rama local tiene $ahead commit(s) no publicados frente a '$remoteBranch'. Publícalos o resuelve la diferencia antes de sincronizar."
    }
}

function Update-RemoteReferences {
    Write-Status '[2/4] Actualizando referencias de origin…'
    Invoke-Git -Arguments @('fetch', 'origin') | Out-Null
}

function Get-CommitCount {
    param([Parameter(Mandatory)][string]$Range)

    return [int](Invoke-Git -Arguments @('rev-list', '--count', $Range) -Quiet)
}

function Sync-Branch {
    param([Parameter(Mandatory)][string]$Branch)

    $remoteBranch = "origin/$Branch"
    Write-Status "[3/4] Integrando cambios de origin/develop en '$Branch'…"
    Invoke-Git -Arguments @('merge', '--ff-only', $remoteBranch) | Out-Null

    Invoke-Git -Arguments @('merge', '--no-edit', 'origin/develop') | Out-Null

    $behind = Get-CommitCount -Range "HEAD..$remoteBranch"
    if ($behind -gt 0) {
        throw "'$remoteBranch' avanzó durante la sincronización. No se hizo push; revisa el estado y vuelve a intentarlo."
    }

    $ahead = Get-CommitCount -Range "$remoteBranch..HEAD"
    if ($ahead -eq 0) {
        Write-Status "[4/4] '$Branch' ya estaba sincronizada; no hace falta publicar cambios." 'Success'
        return
    }

    Write-Status "[4/4] Publicando la sincronización en '$remoteBranch'…"
    Invoke-Git -Arguments @('push', 'origin', $Branch) | Out-Null
    Write-Status "Sincronización completada en '$remoteBranch'." 'Success'
}

function Main {
    try {
        Write-Status '[1/4] Validando rama y estado del árbol de trabajo…'
        $branch = Get-CurrentBranch
        if ([string]::IsNullOrWhiteSpace($branch)) {
            throw 'No se pudo determinar la rama activa. Asegúrate de estar dentro del repositorio.'
        }

        Assert-SyncPreconditions -Branch $branch
        Update-RemoteReferences
        Assert-RemoteBranch -Branch $branch
        Sync-Branch -Branch $branch
    }
    catch {
        Write-Status $_.Exception.Message 'Error'
        exit 1
    }
}

Main
