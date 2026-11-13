param(
    [string]$GithubOwner = "jeffersonmejia",
    [string]$GithubRepository = "app-distribuidas",
    [string]$Environment = "develop",
    [string]$ResourceGroupName = "rg-app-distribuidas-develop",
    [string]$Location = "eastus",
    [string]$DisplayName = "gh-app-distribuidas-develop"
)

$ErrorActionPreference = "Stop"
$repository = "$GithubOwner/$GithubRepository"

function Invoke-AzJson([string[]]$Arguments) {
    $result = & az @Arguments --output json
    if ($LASTEXITCODE -ne 0) { throw "Azure CLI no pudo ejecutar la operación solicitada." }
    return ($result | ConvertFrom-Json)
}

function Set-GitHubVariable([string]$Name, [string]$Value) {
    & gh variable set $Name --repo $repository --env $Environment --body $Value
    if ($LASTEXITCODE -ne 0) { throw "GitHub CLI no pudo guardar la variable $Name." }
}

$account = Invoke-AzJson @('account', 'show')
if ($account.state -ne 'Enabled') { throw "La suscripción Azure activa no está habilitada." }
$subscriptionId = [string]$account.id
$tenantId = [string]$account.tenantId

& gh auth status --hostname github.com
if ($LASTEXITCODE -ne 0) { throw "Inicia sesión en GitHub CLI antes de continuar." }
$null = & gh repo view $repository --json viewerPermission
if ($LASTEXITCODE -ne 0) { throw "La cuenta GitHub activa no tiene acceso a $repository." }

$group = Invoke-AzJson @('group', 'create', '--name', $ResourceGroupName, '--location', $Location, '--tags', 'project=app-distribuidas', 'environment=develop')
$scope = [string]$group.id
$applications = Invoke-AzJson @('ad', 'app', 'list', '--display-name', $DisplayName)
$application = $applications | Where-Object { $_.displayName -eq $DisplayName } | Select-Object -First 1
if (-not $application) { $application = Invoke-AzJson @('ad', 'app', 'create', '--display-name', $DisplayName) }

$servicePrincipals = Invoke-AzJson @('ad', 'sp', 'list', '--filter', "appId eq '$($application.appId)'")
$servicePrincipal = $servicePrincipals | Select-Object -First 1
if (-not $servicePrincipal) { $servicePrincipal = Invoke-AzJson @('ad', 'sp', 'create', '--id', [string]$application.appId) }

foreach ($role in @('Contributor', 'User Access Administrator')) {
    $assignments = Invoke-AzJson @('role', 'assignment', 'list', '--scope', $scope, '--assignee-object-id', [string]$servicePrincipal.id)
    if (-not ($assignments | Where-Object { $_.roleDefinitionName -eq $role -and $_.scope -eq $scope })) {
        $null = Invoke-AzJson @('role', 'assignment', 'create', '--assignee-object-id', [string]$servicePrincipal.id, '--assignee-principal-type', 'ServicePrincipal', '--role', $role, '--scope', $scope)
    }
}

$subject = "repo:$GithubOwner/$GithubRepository`:environment:$Environment"
$credentials = Invoke-AzJson @('ad', 'app', 'federated-credential', 'list', '--id', [string]$application.id)
if (-not ($credentials | Where-Object { $_.subject -eq $subject })) {
    $credentialFile = Join-Path ([System.IO.Path]::GetTempPath()) ("github-oidc-" + [guid]::NewGuid().ToString('N') + '.json')
    $credential = @{
        name        = "github-$Environment"
        issuer      = 'https://token.actions.githubusercontent.com'
        subject     = $subject
        description = "GitHub Actions for $repository ($Environment)"
        audiences   = @('api://AzureADTokenExchange')
    } | ConvertTo-Json -Depth 5
    Set-Content -LiteralPath $credentialFile -Value $credential -Encoding utf8
    try { $null = Invoke-AzJson @('ad', 'app', 'federated-credential', 'create', '--id', [string]$application.id, '--parameters', "@$credentialFile") }
    finally { Remove-Item -LiteralPath $credentialFile -Force -ErrorAction SilentlyContinue }
}

$null = & gh api --method PUT "repos/$repository/environments/$Environment" --field 'deployment_branch_policy[protected_branches]=false' --field 'deployment_branch_policy[custom_branch_policies]=true'
if ($LASTEXITCODE -ne 0) { throw "GitHub CLI no pudo configurar el environment $Environment." }
$policies = & gh api "repos/$repository/environments/$Environment/deployment-branch-policies" | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "GitHub CLI no pudo consultar las políticas de ramas." }
if (-not ($policies.branch_policies | Where-Object { $_.name -eq 'develop' -and $_.type -eq 'branch' })) {
    $null = & gh api --method POST "repos/$repository/environments/$Environment/deployment-branch-policies" --field name=develop --field type=branch
    if ($LASTEXITCODE -ne 0) { throw "GitHub CLI no pudo restringir el environment a develop." }
}

$suffix = & gh variable get AZURE_RESOURCE_SUFFIX --repo $repository --env $Environment 2>$null
if ($LASTEXITCODE -ne 0 -or $suffix -notmatch '^[a-z0-9]{5,8}$') {
    $suffix = -join ((1..6) | ForEach-Object { 'abcdefghijklmnopqrstuvwxyz0123456789'[(Get-Random -Maximum 36)] })
}
Set-GitHubVariable 'AZURE_CLIENT_ID' ([string]$application.appId)
Set-GitHubVariable 'AZURE_TENANT_ID' $tenantId
Set-GitHubVariable 'AZURE_SUBSCRIPTION_ID' $subscriptionId
Set-GitHubVariable 'AZURE_PRINCIPAL_ID' ([string]$servicePrincipal.id)
Set-GitHubVariable 'AZURE_RESOURCE_GROUP' $ResourceGroupName
Set-GitHubVariable 'AZURE_RESOURCE_SUFFIX' $suffix

Write-Host "OIDC listo para $repository en $Environment; roles acotados a $ResourceGroupName."
Write-Host "Sufijo no secreto: $suffix"
Write-Host "Falta el state remoto de Terraform; créalo después de revisar el costo con bootstrap-state.ps1."
