param(
    [string]$GithubOwner = "jeffersonmejia",
    [string]$GithubRepository = "app-distribuidas",
    [string]$Environment = "develop",
    [string]$ResourceGroupName = "rg-app-distribuidas-tfstate",
    [string]$Location = "eastus",
    [string]$StateStorageAccountName
)

$ErrorActionPreference = "Stop"
$repository = "$GithubOwner/$GithubRepository"
$account = az account show --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $account.state -ne 'Enabled') { throw "Inicia sesión en una suscripción Azure habilitada." }
if (-not $StateStorageAccountName) {
    $stableId = ([string]$account.id -replace '-', '').Substring(0, 10).ToLowerInvariant()
    $StateStorageAccountName = "tfappdist$stableId"
}
if ($StateStorageAccountName -notmatch '^[a-z0-9]{3,24}$') { throw "Nombre inválido de Storage Account." }

$storageProvider = az provider show --namespace Microsoft.Storage --query registrationState --output tsv 2>$null
if ($LASTEXITCODE -ne 0 -or $storageProvider -ne 'Registered') {
    $null = az provider register --namespace Microsoft.Storage --wait --output none
    if ($LASTEXITCODE -ne 0) { throw "No se pudo registrar Microsoft.Storage." }
}
$null = az group create --name $ResourceGroupName --location $Location --tags project=app-distribuidas purpose=terraform-state --output none
if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el grupo de recursos del state." }
$null = az storage account create --name $StateStorageAccountName --resource-group $ResourceGroupName --location $Location --sku Standard_LRS --kind StorageV2 --https-only true --min-tls-version TLS1_2 --allow-blob-public-access false --output none
if ($LASTEXITCODE -ne 0) { throw "No se pudo crear la cuenta Storage para el state." }
$null = az storage container create --account-name $StateStorageAccountName --name tfstate --auth-mode login --public-access off --output none
if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el contenedor privado tfstate." }

$scope = az storage account show --name $StateStorageAccountName --resource-group $ResourceGroupName --query id --output tsv
$principalId = gh variable get AZURE_PRINCIPAL_ID --repo $repository --env $Environment
if ($LASTEXITCODE -ne 0 -or -not $principalId) { throw "Ejecuta bootstrap-github-oidc.ps1 primero." }
$existing = az role assignment list --scope $scope --assignee-object-id $principalId --query "[?roleDefinitionName=='Storage Blob Data Contributor'] | length(@)" --output tsv
if ([int]$existing -eq 0) {
    $null = az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" --scope $scope --output none
    if ($LASTEXITCODE -ne 0) { throw "No se pudo asignar acceso al state remoto." }
}
& gh variable set AZURE_TF_STATE_STORAGE --repo $repository --env $Environment --body $StateStorageAccountName
if ($LASTEXITCODE -ne 0) { throw "No se pudo guardar AZURE_TF_STATE_STORAGE." }
& gh variable set AZURE_TF_STATE_RESOURCE_GROUP --repo $repository --env $Environment --body $ResourceGroupName
if ($LASTEXITCODE -ne 0) { throw "No se pudo guardar AZURE_TF_STATE_RESOURCE_GROUP." }

Write-Host "Backend Terraform creado; el contenedor tfstate es privado y usa Azure AD."
