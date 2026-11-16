param(
    [string]$EnvFile = "infra/.env",
    [string]$Environment = "develop",
    [string]$Repository = "jeffersonmejia/app-distribuidas"
)

$ErrorActionPreference = "Stop"
$requiredNames = @('POSTGRES_ADMIN_PASSWORD', 'DB_RUNTIME_PASSWORD', 'DB_MIGRATION_PASSWORD')
if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
    throw "No existe $EnvFile. Crea infra/.env desde infra/.env.example."
}

$values = @{}
foreach ($line in Get-Content -LiteralPath $EnvFile) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
        $values[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
    }
}
foreach ($name in $requiredNames) {
    if (-not $values.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($values[$name]) -or $values[$name] -eq 'REEMPLAZAR') {
        throw "$name debe tener un valor antes de subir secretos."
    }
}

foreach ($name in @('AUTH_ISSUER_URI', 'AUTH_AUDIENCE')) {
    if ($values.ContainsKey($name) -and -not [string]::IsNullOrWhiteSpace($values[$name])) {
        & gh variable set $name --repo $Repository --env $Environment --body $values[$name]
        if ($LASTEXITCODE -ne 0) { throw "GitHub CLI no pudo guardar la variable $name." }
    }
}

foreach ($name in $requiredNames) {
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $process.StartInfo.FileName = 'gh'
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.RedirectStandardInput = $true
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    $process.StartInfo.CreateNoWindow = $true
    foreach ($argument in @('secret', 'set', $name, '--repo', $Repository, '--env', $Environment)) {
        $process.StartInfo.ArgumentList.Add($argument)
    }
    if (-not $process.Start()) { throw "No se pudo iniciar GitHub CLI." }
    $process.StandardInput.Write($values[$name])
    $process.StandardInput.Close()
    $null = $process.StandardOutput.ReadToEnd()
    $null = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw "GitHub CLI no pudo guardar $name. Revisa gh auth status y el environment $Environment." }
}

$values.Clear()
Write-Host "Se guardaron los tres secretos de PostgreSQL en el environment $Environment; no se mostraron sus valores."
