[CmdletBinding()]
param(
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'

$script:ProjectConfigPath = Join-Path $PSScriptRoot 'project.yml'
$script:TasksPath = Join-Path $PSScriptRoot 'tasks.yml'
$script:RequiredStatuses = @('Pendiente', 'En progreso', 'En revisión', 'Completado', 'Bloqueado')
$script:RequiredPriorities = @('Alta', 'Media', 'Baja')

function Invoke-Gh {
    param([string[]]$Arguments)

    $output = & gh @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        $message = (@($output | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).Trim()
        throw "Falló gh $($Arguments -join ' '): $message"
    }
    return @($output | ForEach-Object { [string]$_ })
}

function Invoke-GhText {
    param([string[]]$Arguments)
    return ((Invoke-Gh -Arguments $Arguments) -join [Environment]::NewLine).Trim()
}

function Invoke-GhJson {
    param([string[]]$Arguments)
    $text = (Invoke-Gh -Arguments $Arguments) -join [Environment]::NewLine
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    return ($text | ConvertFrom-Json)
}

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "No existe el archivo requerido: $Path"
    }
    return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
}

function Get-TaskOrder {
    param([object[]]$Tasks)

    $byId = @{}
    foreach ($task in $Tasks) {
        if ([string]::IsNullOrWhiteSpace($task.id)) { throw 'Cada tarea debe tener un id.' }
        if ($byId.ContainsKey($task.id)) { throw "Identificador duplicado en tasks.yml: $($task.id)" }
        if ([string]::IsNullOrWhiteSpace($task.title)) { throw "La tarea $($task.id) no tiene título." }
        if ($task.state -notin $script:RequiredStatuses) { throw "Estado inválido en $($task.id): $($task.state)" }
        if ($task.priority -notin $script:RequiredPriorities) { throw "Prioridad inválida en $($task.id): $($task.priority)" }
        $byId[$task.id] = $task
    }

    foreach ($task in $Tasks) {
        foreach ($dependency in @($task.dependencies)) {
            if (-not $byId.ContainsKey([string]$dependency)) {
                throw "La tarea $($task.id) depende de un identificador inexistente: $dependency"
            }
        }
    }

    $ordered = New-Object 'System.Collections.Generic.List[object]'
    $done = @{}
    while ($ordered.Count -lt $Tasks.Count) {
        $added = $false
        foreach ($task in $Tasks) {
            if ($done.ContainsKey($task.id)) { continue }
            $ready = $true
            foreach ($dependency in @($task.dependencies)) {
                if (-not $done.ContainsKey([string]$dependency)) { $ready = $false; break }
            }
            if ($ready) {
                $ordered.Add($task)
                $done[$task.id] = $true
                $added = $true
            }
        }
        if (-not $added) { throw 'Se detectó un ciclo en las dependencias de tasks.yml.' }
    }
    return ,$ordered.ToArray()
}

function Get-RepoAndAuthContext {
    param([switch]$RequireWriteScopes)

    $authLines = Invoke-Gh -Arguments @('auth', 'status', '--hostname', 'github.com')
    $scopeLine = $authLines | Where-Object { $_ -match 'Token scopes:' } | Select-Object -First 1
    $scopes = @()
    if ($scopeLine -match "Token scopes:\s*(.*)$") {
        $scopes = @([regex]::Matches($Matches[1], "'([^']+)'") | ForEach-Object { $_.Groups[1].Value })
    }

    $repoData = Invoke-GhJson -Arguments @('repo', 'view', '--json', 'nameWithOwner,owner,viewerPermission')
    if (-not $repoData -or [string]::IsNullOrWhiteSpace($repoData.nameWithOwner)) {
        throw 'gh repo view no pudo detectar el repositorio actual.'
    }
    $login = Invoke-GhText -Arguments @('api', 'user', '--jq', '.login')
    $ownerType = Invoke-GhText -Arguments @('api', "repos/$($repoData.nameWithOwner)", '--jq', '.owner.type')
    $permission = [string]$repoData.viewerPermission

    if ($RequireWriteScopes) {
        foreach ($required in @('repo', 'project')) {
            if ($scopes -notcontains $required) {
                throw "Falta el scope '$required'. Ejecuta gh auth refresh -h github.com -s $required y vuelve a intentarlo."
            }
        }
        if ($permission -notin @('ADMIN', 'MAINTAIN', 'WRITE')) {
            throw "La cuenta autenticada tiene permiso '$permission' en $($repoData.nameWithOwner); se requiere escritura para crear Issues."
        }
        if ($ownerType -eq 'User' -and $login -ne $repoData.owner.login) {
            throw "El proyecto debe pertenecer a $($repoData.owner.login), pero la cuenta activa es $login. No se aplicaron cambios remotos."
        }
    }

    return [pscustomobject]@{
        Repository = [string]$repoData.nameWithOwner
        RepositoryName = [string]($repoData.nameWithOwner.Split('/')[-1])
        Owner = [string]$repoData.owner.login
        OwnerType = $ownerType
        Login = $login
        Permission = $permission
        Scopes = $scopes
    }
}

function Get-GraphQlData {
    param(
        [string]$Query,
        [string]$Owner,
        [string]$OwnerType,
        [hashtable]$Variables = @{}
    )

    $arguments = @('api', 'graphql', '-f', "query=$Query", '-F', "owner=$Owner")
    foreach ($key in $Variables.Keys) {
        $arguments += @('-F', "$key=$($Variables[$key])")
    }
    $response = Invoke-GhJson -Arguments $arguments
    if ($response.errors) {
        throw "GitHub GraphQL devolvió un error: $(($response.errors | ForEach-Object { $_.message }) -join '; ')"
    }
    if ($OwnerType -eq 'Organization') { return $response.data.organization }
    return $response.data.user
}

function Get-Projects {
    param([object]$Context)
    $root = if ($Context.OwnerType -eq 'Organization') { 'organization' } else { 'user' }
    $query = "query(`$owner:String!){$root(login:`$owner){projectsV2(first:100){nodes{id number title url}}}}"
    $ownerData = Get-GraphQlData -Query $query -Owner $Context.Owner -OwnerType $Context.OwnerType
    return @($ownerData.projectsV2.nodes)
}

function Get-ProjectState {
    param([object]$Context, [int]$Number)
    $root = if ($Context.OwnerType -eq 'Organization') { 'organization' } else { 'user' }
    $query = @"
query(`$owner:String!,`$number:Int!){
  $root(login:`$owner){
    projectV2(number:`$number){
      id number title url
      repositories(first:100){nodes{nameWithOwner}}
      views(first:50){nodes{id number name layout}}
      fields(first:100){nodes{
        ... on ProjectV2FieldCommon{id name dataType}
        ... on ProjectV2SingleSelectField{id name options{id name}}
      }}
      items(first:100){nodes{
        id
        content{... on Issue{id number url title body state repository{nameWithOwner} assignees(first:20){nodes{login}} blockedBy(first:100){nodes{number title body}}}}
        fieldValues(first:50){nodes{
          ... on ProjectV2ItemFieldTextValue{text field{... on ProjectV2FieldCommon{name}}}
          ... on ProjectV2ItemFieldDateValue{date field{... on ProjectV2FieldCommon{name}}}
          ... on ProjectV2ItemFieldSingleSelectValue{name optionId field{... on ProjectV2FieldCommon{name}}}
        }}
      }}
    }
  }
}
"@
    $ownerData = Get-GraphQlData -Query $query -Owner $Context.Owner -OwnerType $Context.OwnerType -Variables @{ number = $Number }
    return $ownerData.projectV2
}

function Get-AllIssues {
    param([object]$Context)
    $path = "repos/$($Context.Repository)/issues?state=all&per_page=100"
    $lines = Invoke-Gh -Arguments @('api', $path, '--paginate', '--jq', '.[] | select(.pull_request == null) | {number, node_id, title, body, assignees: [.assignees[].login], url: .html_url}')
    $issues = New-Object 'System.Collections.Generic.List[object]'
    foreach ($line in $lines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $issues.Add(($line | ConvertFrom-Json))
    }
    return ,$issues.ToArray()
}

function Get-Collaborators {
    param([object]$Context)
    $path = "repos/$($Context.Repository)/collaborators?per_page=100"
    $lines = Invoke-Gh -Arguments @('api', $path, '--paginate', '--jq', '.[] | {login, permissions}')
    $result = @{}
    foreach ($line in $lines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $person = $line | ConvertFrom-Json
        $result[[string]$person.login] = $person
    }
    return $result
}

function Resolve-Assignees {
    param([object[]]$Tasks, [hashtable]$Collaborators)
    $resolved = @{}
    foreach ($task in $Tasks) {
        $requested = [string]$task.assignee
        if ([string]::IsNullOrWhiteSpace($requested)) {
            $resolved[$task.id] = $null
            if ($task.requestedAssignee) {
                Write-Host "  SIN ASIGNAR $($task.id): $($task.assignmentNote)" -ForegroundColor Yellow
            }
            continue
        }

        $person = $null
        foreach ($login in $Collaborators.Keys) {
            if ($login -ieq $requested) { $person = $Collaborators[$login]; break }
        }
        if (-not $person) {
            Write-Warning "La cuenta '$requested' de $($task.id) no tiene acceso al repositorio; el Issue quedará sin asignar."
            $resolved[$task.id] = $null
            continue
        }
        $permissions = $person.permissions
        if (-not ($permissions.push -or $permissions.maintain -or $permissions.admin)) {
            Write-Warning "La cuenta '$($person.login)' de $($task.id) solo tiene lectura; el Issue quedará sin asignar."
            $resolved[$task.id] = $null
            continue
        }
        $resolved[$task.id] = [string]$person.login
    }
    return $resolved
}

function Get-TaskBody {
    param([object]$Task, [string]$EffectiveAssignee)
    $criteria = @($Task.acceptanceCriteria | ForEach-Object { "- $_" }) -join "`n"
    $paths = @($Task.paths) -join ', '
    $dependencies = if (@($Task.dependencies).Count -gt 0) { @($Task.dependencies) -join ', ' } else { 'Ninguna' }
    $responsible = if ($EffectiveAssignee) { "@$EffectiveAssignee" } else { 'Sin asignar' }
    $lines = @(
        "<!-- managed-task-id: $($Task.id) -->",
        '',
        '## Descripción',
        [string]$Task.description,
        '',
        '## Criterios de aceptación',
        $criteria,
        '',
        '## Gestión',
        "- Área: $($Task.area)",
        "- Prioridad: $($Task.priority)",
        "- Estado: $($Task.state)",
        "- Responsable: $responsible",
        "- Rama: $($Task.branch)",
        "- Rutas: $paths",
        "- Dependencias: $dependencies"
    )
    if ($Task.completedAt) { $lines += "- Fecha de completado: $($Task.completedAt)" }
    return $lines -join "`n"
}

function Get-TaskSnapshot {
    param([object]$Task, [string]$EffectiveAssignee)
    return [ordered]@{
        title = "[$($Task.id)] $($Task.title)"
        body = Get-TaskBody -Task $Task -EffectiveAssignee $EffectiveAssignee
        assignee = if ([string]::IsNullOrWhiteSpace($EffectiveAssignee)) { $null } else { $EffectiveAssignee }
        state = [string]$Task.state
        priority = [string]$Task.priority
        area = [string]$Task.area
        identifier = [string]$Task.id
        targetDate = if ($Task.targetDate) { [string]$Task.targetDate } else { $null }
        completedAt = if ($Task.completedAt) { [string]$Task.completedAt } else { $null }
        dependencies = @($Task.dependencies | Sort-Object)
    }
}

function Get-SnapshotHash {
    param([System.Collections.IDictionary]$Snapshot)
    $json = ConvertTo-Json -InputObject $Snapshot -Depth 20 -Compress
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally { $sha.Dispose() }
}

function Get-MarkerId {
    param([string]$Body)
    if ($Body -match '<!-- managed-task-id:\s*([A-Z]+-\d+)\s*-->') { return $Matches[1] }
    return $null
}

function Get-ProjectItemForIssue {
    param([object]$ProjectState, [object]$Issue, [string]$Repository)
    if (-not $ProjectState) { return $null }
    foreach ($item in @($ProjectState.items.nodes)) {
        if ($item.content -and [int]$item.content.number -eq [int]$Issue.number -and $item.content.repository.nameWithOwner -eq $Repository) {
            return $item
        }
    }
    return $null
}

function Get-ItemFieldValue {
    param([object]$Item, [string]$FieldName)
    if (-not $Item) { return $null }
    foreach ($value in @($Item.fieldValues.nodes)) {
        if (-not $value.field -or $value.field.name -ne $FieldName) { continue }
        if ($value.PSObject.Properties.Name -contains 'text') { return [string]$value.text }
        if ($value.PSObject.Properties.Name -contains 'date') { return [string]$value.date }
        if ($value.PSObject.Properties.Name -contains 'name') { return [string]$value.name }
    }
    return $null
}

function Get-BlockerIds {
    param([object]$Blockers)
    $ids = @()
    foreach ($blocker in @($Blockers)) {
        $marker = Get-MarkerId -Body ([string]$blocker.body)
        if ($marker) { $ids += $marker } else { $ids += "#$($blocker.number)" }
    }
    return @($ids | Sort-Object -Unique)
}

function Get-IssueBlockers {
    param([object]$Issue)
    $query = 'query($id:ID!){node(id:$id){... on Issue{blockedBy(first:100){nodes{number title body}}}}}'
    $response = Invoke-GhJson -Arguments @('api', 'graphql', '-f', "query=$query", '-F', "id=$($Issue.node_id)")
    if ($response.errors) { throw "No se pudieron leer dependencias del Issue #$($Issue.number)." }
    return @($response.data.node.blockedBy.nodes)
}

function Get-ActualSnapshot {
    param([object]$Issue, [object]$Item, [string[]]$DependencyIds)
    $assignees = @($Issue.assignees | Sort-Object)
    $assignee = if ($assignees.Count -eq 1) { [string]$assignees[0] } elseif ($assignees.Count -eq 0) { $null } else { $assignees -join ',' }
    return [ordered]@{
        title = [string]$Issue.title
        body = [string]$Issue.body
        assignee = $assignee
        state = Get-ItemFieldValue -Item $Item -FieldName 'Estado'
        priority = Get-ItemFieldValue -Item $Item -FieldName 'Prioridad'
        area = Get-ItemFieldValue -Item $Item -FieldName 'Área'
        identifier = Get-ItemFieldValue -Item $Item -FieldName 'Identificador de tarea'
        targetDate = Get-ItemFieldValue -Item $Item -FieldName 'Fecha objetivo'
        completedAt = Get-ItemFieldValue -Item $Item -FieldName 'Fecha de completado'
        dependencies = @($DependencyIds | Sort-Object)
    }
}

function Find-TaskIssues {
    param([object[]]$Issues, [object]$Task)
    $matches = New-Object 'System.Collections.Generic.List[object]'
    foreach ($issue in $Issues) {
        if ((Get-MarkerId -Body ([string]$issue.body)) -eq $Task.id) { $matches.Add($issue) }
    }
    return ,$matches.ToArray()
}

function Get-FieldDefinitions {
    param([object]$Config)
    return @($Config.fields)
}

function Get-FieldByName {
    param([object]$ProjectState, [string]$Name)
    $found = @($ProjectState.fields.nodes | Where-Object { $_.name -eq $Name })
    if ($found.Count -gt 1) { throw "El proyecto tiene campos duplicados llamados '$Name'; se omiten cambios." }
    if ($found.Count -eq 1) { return $found[0] }
    return $null
}

function Assert-FieldCompatibility {
    param([object]$ProjectState, [object]$Config)
    foreach ($definition in (Get-FieldDefinitions -Config $Config)) {
        $field = Get-FieldByName -ProjectState $ProjectState -Name $definition.name
        if (-not $field) { continue }
        if ($field.dataType -ne $definition.type) {
            throw "Conflicto en campo '$($definition.name)': existe como $($field.dataType), se esperaba $($definition.type). No se modificó."
        }
        if ($definition.type -eq 'SINGLE_SELECT') {
            $actual = @($field.options | ForEach-Object { $_.name })
            if (($actual -join "`n") -ne (@($definition.options) -join "`n")) {
                throw "Conflicto en opciones de '$($definition.name)'. No se sobrescribieron opciones existentes."
            }
        }
    }
}

function Ensure-ProjectFields {
    param([object]$Context, [object]$Config, [object]$ProjectState)
    Assert-FieldCompatibility -ProjectState $ProjectState -Config $Config
    foreach ($definition in (Get-FieldDefinitions -Config $Config)) {
        if (Get-FieldByName -ProjectState $ProjectState -Name $definition.name) { continue }
        $arguments = @('project', 'field-create', [string]$ProjectState.number, '--owner', $Context.Owner, '--name', [string]$definition.name, '--data-type', [string]$definition.type)
        if ($definition.type -eq 'SINGLE_SELECT') {
            $arguments += @('--single-select-options', (@($definition.options) -join ','))
        }
        $null = Invoke-Gh -Arguments $arguments
        $ProjectState = Get-ProjectState -Context $Context -Number ([int]$ProjectState.number)
        $created = Get-FieldByName -ProjectState $ProjectState -Name $definition.name
        if (-not $created -or $created.dataType -ne $definition.type) {
            throw "GitHub no confirmó la creación correcta del campo '$($definition.name)'."
        }
    }
    Assert-FieldCompatibility -ProjectState $ProjectState -Config $Config
    return $ProjectState
}

function Ensure-ProjectLink {
    param([object]$Context, [object]$ProjectState)
    $linked = @($ProjectState.repositories.nodes | Where-Object { $_.nameWithOwner -eq $Context.Repository })
    if ($linked.Count -gt 0) { return }
    $null = Invoke-Gh -Arguments @('project', 'link', [string]$ProjectState.number, '--owner', $Context.Owner, '--repo', $Context.RepositoryName)
}

function Ensure-ProjectViews {
    param([object]$Context, [object]$Config, [object]$ProjectState)
    foreach ($viewDefinition in @($Config.views)) {
        $layout = switch ([string]$viewDefinition.layout) {
            'BOARD' { 'BOARD_LAYOUT' }
            'TABLE' { 'TABLE_LAYOUT' }
            default { throw "Layout de vista no admitido: $($viewDefinition.layout)" }
        }
        $matches = @($ProjectState.views.nodes | Where-Object { $_.name -ceq [string]$viewDefinition.name })
        if ($matches.Count -gt 1) { throw "Hay vistas duplicadas llamadas '$($viewDefinition.name)'; no se modifican." }
        if ($matches.Count -eq 1) {
            if ($matches[0].layout -ne $layout) { throw "La vista '$($viewDefinition.name)' ya existe con otro layout; no se sobrescribe." }
            continue
        }

        $mutation = 'mutation($projectId:ID!,$name:String!,$layout:ProjectV2ViewLayout!){createProjectV2View(input:{projectId:$projectId,name:$name,layout:$layout}){projectV2View{id number name layout}}}'
        $null = Invoke-GhJson -Arguments @('api', 'graphql', '-f', "query=$mutation", '-F', "projectId=$($ProjectState.id)", '-F', "name=$($viewDefinition.name)", '-F', "layout=$layout")
        $ProjectState = Get-ProjectState -Context $Context -Number ([int]$ProjectState.number)
        $created = @($ProjectState.views.nodes | Where-Object { $_.name -ceq [string]$viewDefinition.name -and $_.layout -eq $layout })
        if ($created.Count -ne 1) { throw "GitHub no confirmó la creación de la vista '$($viewDefinition.name)'." }
    }
    return $ProjectState
}

function Ensure-ProjectItem {
    param([object]$Context, [object]$ProjectState, [object]$Issue)
    $present = Get-ProjectItemForIssue -ProjectState $ProjectState -Issue $Issue -Repository $Context.Repository
    if (-not $present) {
        $null = Invoke-Gh -Arguments @('project', 'item-add', [string]$ProjectState.number, '--owner', $Context.Owner, '--url', [string]$Issue.url)
    }
}

function Set-ProjectItemFields {
    param([object]$Context, [int]$ProjectNumber, [object]$Task, [string]$IssueUrl, [string]$CurrentDate = $null, [string]$CurrentCompletedDate = $null)
    foreach ($pair in @(
        @{ Name = 'Estado'; Value = [string]$Task.state; Kind = 'single' },
        @{ Name = 'Prioridad'; Value = [string]$Task.priority; Kind = 'single' },
        @{ Name = 'Área'; Value = [string]$Task.area; Kind = 'single' },
        @{ Name = 'Identificador de tarea'; Value = [string]$Task.id; Kind = 'text' }
    )) {
        $arguments = @('project', 'item-edit', [string]$ProjectNumber, '--owner', $Context.Owner, '--url', $IssueUrl, '--field', $pair.Name)
        if ($pair.Kind -eq 'text') { $arguments += @('--text', $pair.Value) } else { $arguments += @('--value', $pair.Value) }
        $null = Invoke-Gh -Arguments $arguments
    }

    foreach ($date in @(
        @{ Name = 'Fecha objetivo'; Value = $Task.targetDate; Current = $CurrentDate },
        @{ Name = 'Fecha de completado'; Value = $Task.completedAt; Current = $CurrentCompletedDate }
    )) {
        $dateArguments = @('project', 'item-edit', [string]$ProjectNumber, '--owner', $Context.Owner, '--url', $IssueUrl, '--field', $date.Name)
        if ($date.Value) {
            $dateArguments += @('--date', [string]$date.Value)
        }
        elseif ($date.Current) {
            $dateArguments += '--clear'
        }
        if ($date.Value -or $date.Current) { $null = Invoke-Gh -Arguments $dateArguments }
    }
}

function New-IssueBodyFile {
    param([string]$Body)
    $path = [System.IO.Path]::GetTempFileName()
    $utf8WithoutBom = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
    [System.IO.File]::WriteAllText($path, $Body, $utf8WithoutBom)
    return $path
}

function Create-ManagedIssue {
    param(
        [object]$Context,
        [object]$ProjectState,
        [object]$Task,
        [string]$EffectiveAssignee,
        [hashtable]$IssueNumbers
    )

    $title = "[$($Task.id)] $($Task.title)"
    $body = Get-TaskBody -Task $Task -EffectiveAssignee $EffectiveAssignee
    $bodyFile = New-IssueBodyFile -Body $body
    try {
        $arguments = @('issue', 'create', '--repo', $Context.Repository, '--title', $title, '--body-file', $bodyFile)
        if ($EffectiveAssignee) { $arguments += @('--assignee', $EffectiveAssignee) }
        $blockerNumbers = @()
        foreach ($dependency in @($Task.dependencies)) {
            if (-not $IssueNumbers.ContainsKey([string]$dependency)) {
                throw "No se crea $($Task.id): el prerrequisito $dependency no tiene un Issue sincronizado."
            }
            $blockerNumbers += [string]$IssueNumbers[[string]$dependency]
        }
        if ($blockerNumbers.Count -gt 0) { $arguments += @('--blocked-by', ($blockerNumbers -join ',')) }
        $output = Invoke-Gh -Arguments $arguments
        $issueUrl = (($output -join "`n") | Select-String -Pattern 'https://github\.com/[^\s]+/issues/\d+' -AllMatches).Matches | Select-Object -First 1
        if (-not $issueUrl) { throw "GitHub no devolvió la URL del Issue $($Task.id). Revisa el repositorio antes de reintentar." }
        $url = [string]$issueUrl.Value
        $number = [int]([regex]::Match($url, '/issues/(\d+)$').Groups[1].Value)
        $issue = [pscustomobject]@{ number = $number; title = $title; body = $body; assignees = @($EffectiveAssignee | Where-Object { $_ }); url = $url }
        Ensure-ProjectItem -Context $Context -ProjectState $ProjectState -Issue $issue
        Set-ProjectItemFields -Context $Context -ProjectNumber ([int]$ProjectState.number) -Task $Task -IssueUrl $url
        return $issue
    }
    finally {
        Remove-Item -LiteralPath $bodyFile -Force -ErrorAction SilentlyContinue
    }
}

function Update-ManagedIssue {
    param(
        [object]$Context,
        [object]$ProjectState,
        [object]$Task,
        [object]$Issue,
        [string]$EffectiveAssignee,
        [string]$CurrentDate,
        [string]$CurrentCompletedDate,
        [object[]]$CurrentBlockers,
        [hashtable]$IssueNumbers
    )

    $body = Get-TaskBody -Task $Task -EffectiveAssignee $EffectiveAssignee
    $arguments = @('issue', 'edit', [string]$Issue.number, '--repo', $Context.Repository, '--title', "[$($Task.id)] $($Task.title)")
    $bodyFile = New-IssueBodyFile -Body $body
    try {
        $arguments += @('--body-file', $bodyFile)
        $currentAssignees = @($Issue.assignees)
        foreach ($assignee in $currentAssignees) {
            if ($assignee -and $assignee -ne $EffectiveAssignee) { $arguments += @('--remove-assignee', [string]$assignee) }
        }
        if ($EffectiveAssignee -and $currentAssignees -notcontains $EffectiveAssignee) {
            $arguments += @('--add-assignee', $EffectiveAssignee)
        }
        $null = Invoke-Gh -Arguments $arguments

        $currentBlockerIds = Get-BlockerIds -Blockers $CurrentBlockers
        foreach ($oldId in $currentBlockerIds) {
            if ($oldId -like '#*') { throw "Conflicto de dependencia externa en $($Task.id); se omiten cambios de dependencias." }
            if (@($Task.dependencies) -notcontains $oldId -and $IssueNumbers.ContainsKey($oldId)) {
                $null = Invoke-Gh -Arguments @('issue', 'edit', [string]$Issue.number, '--repo', $Context.Repository, '--remove-blocked-by', [string]$IssueNumbers[$oldId])
            }
        }
        foreach ($dependency in @($Task.dependencies)) {
            if ($currentBlockerIds -notcontains [string]$dependency) {
                if (-not $IssueNumbers.ContainsKey([string]$dependency)) { throw "No se puede actualizar $($Task.id): falta el Issue de $dependency." }
                $null = Invoke-Gh -Arguments @('issue', 'edit', [string]$Issue.number, '--repo', $Context.Repository, '--add-blocked-by', [string]$IssueNumbers[[string]$dependency])
            }
        }
        Set-ProjectItemFields -Context $Context -ProjectNumber ([int]$ProjectState.number) -Task $Task -IssueUrl ([string]$Issue.url) -CurrentDate $CurrentDate -CurrentCompletedDate $CurrentCompletedDate
        $Issue.title = "[$($Task.id)] $($Task.title)"
        $Issue.body = $body
        $Issue.assignees = @($EffectiveAssignee | Where-Object { $_ })
        return $Issue
    }
    finally {
        Remove-Item -LiteralPath $bodyFile -Force -ErrorAction SilentlyContinue
    }
}

function Write-SyncSummary {
    param([object]$Context, [object]$Project, [object[]]$Tasks, [hashtable]$Assignees, [object[]]$Issues)
    Write-Host ''
    Write-Host '=== Resumen de sincronización ===' -ForegroundColor Cyan
    Write-Host "Repositorio: $($Context.Repository)"
    Write-Host "Propietario del proyecto: $($Context.Owner)"
    if ($Project) {
        Write-Host "Proyecto existente: #$($Project.number) $($Project.title) ($($Project.url))"
    }
    else {
        Write-Host "Proyecto: se crearía '$($script:ProjectConfig.title)'"
    }
    foreach ($task in $Tasks) {
        $matches = Find-TaskIssues -Issues $Issues -Task $task
        $assignment = if ($Assignees.ContainsKey($task.id) -and $Assignees[$task.id]) { "@$($Assignees[$task.id])" } else { 'sin asignar' }
        if ($matches.Count -gt 1) {
            $action = 'CONFLICTO: id duplicado en GitHub'
        }
        elseif ($matches.Count -eq 1) {
            $action = "reutilizar Issue #$($matches[0].number)"
        }
        else {
            $action = 'crear Issue'
        }
        Write-Host ("{0,-12} {1,-31} {2,-22} {3}" -f $task.id, $task.priority, $assignment, $action)
    }
    Write-Host 'Se sincronizan las fechas objetivo y de completado; no se cierran Issues.'
    if (-not $Apply) { Write-Host 'Modo simulación: no se escribirá en GitHub ni se guardará el YAML.' -ForegroundColor Yellow }
    else { Write-Host 'Modo Apply: el resumen anterior se aplicará a GitHub.' -ForegroundColor Yellow }
}

function Get-Plan {
    param([object[]]$Tasks, [object[]]$Issues, [object]$ProjectState, [object]$Context, [hashtable]$Assignees)
    $plans = @{}
    foreach ($task in $Tasks) {
        $matches = Find-TaskIssues -Issues $Issues -Task $task
        if ($matches.Count -gt 1) {
            $plans[$task.id] = [pscustomobject]@{ Action = 'Conflict'; Issue = $null; Item = $null; Blockers = @(); Reason = 'Hay varios Issues con el mismo identificador.' }
            continue
        }
        if ($task.githubIssue -and $matches.Count -eq 0) {
            $plans[$task.id] = [pscustomobject]@{ Action = 'Conflict'; Issue = $null; Item = $null; Blockers = @(); Reason = "El Issue #$($task.githubIssue) guardado ya no se encontró; no se recrea automáticamente." }
            continue
        }
        if ($matches.Count -eq 0) {
            $plans[$task.id] = [pscustomobject]@{ Action = 'Create'; Issue = $null; Item = $null; Blockers = @(); Reason = $null }
            continue
        }

        $issue = $matches[0]
        if ($task.githubIssue -and [int]$task.githubIssue -ne [int]$issue.number) {
            $plans[$task.id] = [pscustomobject]@{ Action = 'Conflict'; Issue = $issue; Item = $null; Blockers = @(); Reason = "El Issue marcado (#$($issue.number)) difiere del número guardado (#$($task.githubIssue))." }
            continue
        }
        $item = Get-ProjectItemForIssue -ProjectState $ProjectState -Issue $issue -Repository $Context.Repository
        $blockers = @(Get-IssueBlockers -Issue $issue)
        $blockerIds = Get-BlockerIds -Blockers $blockers
        $actual = Get-ActualSnapshot -Issue $issue -Item $item -DependencyIds $blockerIds
        $actualHash = Get-SnapshotHash -Snapshot $actual
        $desired = Get-TaskSnapshot -Task $task -EffectiveAssignee $Assignees[$task.id]
        $desiredHash = Get-SnapshotHash -Snapshot $desired

        if ($task.syncFingerprint) {
            if (-not $item) {
                $plans[$task.id] = [pscustomobject]@{ Action = 'Conflict'; Issue = $issue; Item = $null; Blockers = $blockers; Reason = 'El Issue fue retirado del proyecto desde la última sincronización.' }
            }
            elseif ($actualHash -ne [string]$task.syncFingerprint) {
                $plans[$task.id] = [pscustomobject]@{ Action = 'Conflict'; Issue = $issue; Item = $item; Blockers = $blockers; Reason = 'Los campos administrados cambiaron directamente en GitHub desde la última sincronización.' }
            }
            elseif ($actualHash -eq $desiredHash) {
                $plans[$task.id] = [pscustomobject]@{ Action = 'NoOp'; Issue = $issue; Item = $item; Blockers = $blockers; Reason = $null }
            }
            else {
                $plans[$task.id] = [pscustomobject]@{ Action = 'Update'; Issue = $issue; Item = $item; Blockers = $blockers; Reason = $null }
            }
        }
        elseif (-not $item) {
            $issueOnly = [ordered]@{
                title = [string]$issue.title
                body = [string]$issue.body
                assignee = if (@($issue.assignees).Count -eq 1) { [string]@($issue.assignees)[0] } elseif (@($issue.assignees).Count -eq 0) { $null } else { @($issue.assignees) -join ',' }
            }
            $desiredOnly = [ordered]@{ title = $desired.title; body = $desired.body; assignee = $desired.assignee }
            if ((Get-SnapshotHash -Snapshot $issueOnly) -eq (Get-SnapshotHash -Snapshot $desiredOnly) -and (@($blockerIds) -join '|') -eq (@($task.dependencies | Sort-Object) -join '|')) {
                $plans[$task.id] = [pscustomobject]@{ Action = 'Adopt'; Issue = $issue; Item = $null; Blockers = $blockers; Reason = $null }
            }
            else {
                $plans[$task.id] = [pscustomobject]@{ Action = 'Conflict'; Issue = $issue; Item = $null; Blockers = $blockers; Reason = 'Existe un Issue con el identificador, pero su título, cuerpo, responsable o dependencias no coincide.' }
            }
        }
        elseif ($actualHash -eq $desiredHash) {
            $plans[$task.id] = [pscustomobject]@{ Action = 'Adopt'; Issue = $issue; Item = $item; Blockers = $blockers; Reason = $null }
        }
        else {
            $plans[$task.id] = [pscustomobject]@{ Action = 'Conflict'; Issue = $issue; Item = $item; Blockers = $blockers; Reason = 'Hay un Issue no registrado previamente y sus valores difieren de tasks.yml.' }
        }
    }
    return $plans
}

function Set-TaskSyncState {
    param([object]$Task, [object]$Issue, [string]$EffectiveAssignee)
    $Task.githubIssue = [int]$Issue.number
    $Task.syncFingerprint = Get-SnapshotHash -Snapshot (Get-TaskSnapshot -Task $Task -EffectiveAssignee $EffectiveAssignee)
}

function Save-Tasks {
    param([object]$Document)
    $json = ConvertTo-Json -InputObject $Document -Depth 50
    Set-Content -LiteralPath $script:TasksPath -Value $json -Encoding UTF8
}

function Invoke-ApplyPlan {
    param(
        [object]$Context,
        [object]$Config,
        [object[]]$OrderedTasks,
        [hashtable]$Plans,
        [hashtable]$Assignees,
        [object]$ProjectState,
        [hashtable]$IssueNumbers,
        [object]$TasksDocument
    )

    $projects = Get-Projects -Context $Context
    $sameTitle = @($projects | Where-Object { $_.title -ceq [string]$Config.title })
    if ($sameTitle.Count -gt 1) { throw "Hay más de un proyecto llamado '$($Config.title)'; no se creará ni elegirá uno automáticamente." }
    if (-not $ProjectState) {
        if ($sameTitle.Count -eq 0) {
            Write-Host "Creando proyecto '$($Config.title)'..."
            $null = Invoke-Gh -Arguments @('project', 'create', '--owner', $Context.Owner, '--title', [string]$Config.title)
            $projects = Get-Projects -Context $Context
            $sameTitle = @($projects | Where-Object { $_.title -ceq [string]$Config.title })
        }
        if ($sameTitle.Count -ne 1) { throw 'No se pudo resolver de forma única el proyecto después de crearlo.' }
        $ProjectState = Get-ProjectState -Context $Context -Number ([int]$sameTitle[0].number)
    }

    Assert-FieldCompatibility -ProjectState $ProjectState -Config $Config
    $ProjectState = Ensure-ProjectFields -Context $Context -Config $Config -ProjectState $ProjectState
    Ensure-ProjectLink -Context $Context -ProjectState $ProjectState
    $ProjectState = Ensure-ProjectViews -Context $Context -Config $Config -ProjectState $ProjectState

    $successful = @{}
    foreach ($task in $OrderedTasks) {
        $plan = $Plans[$task.id]
        if ($plan.Action -eq 'Conflict') {
            Write-Warning "$($task.id): $($plan.Reason) Se omite sin modificar GitHub."
            continue
        }
        $missingDependencies = @($task.dependencies | Where-Object { -not $IssueNumbers.ContainsKey([string]$_) -and -not $successful.ContainsKey([string]$_) })
        if ($missingDependencies.Count -gt 0) {
            Write-Warning "$($task.id): se omite porque no están sincronizados sus prerrequisitos: $($missingDependencies -join ', ')."
            continue
        }

        try {
            if ($plan.Action -eq 'Create') {
                # Recheck the permanent marker immediately before creation to avoid a duplicate after an interrupted run.
                $freshIssues = Get-AllIssues -Context $Context
                $freshMatches = Find-TaskIssues -Issues $freshIssues -Task $task
                if ($freshMatches.Count -gt 0) {
                    Write-Warning "$($task.id): apareció un Issue durante la sincronización; se omite para revisión manual."
                    continue
                }
                $issue = Create-ManagedIssue -Context $Context -ProjectState $ProjectState -Task $task -EffectiveAssignee $Assignees[$task.id] -IssueNumbers $IssueNumbers
                Write-Host "Creado $($task.id) como Issue #$($issue.number)."
            }
            elseif ($plan.Action -eq 'Update') {
                $currentDate = Get-ItemFieldValue -Item $plan.Item -FieldName 'Fecha objetivo'
                $currentCompletedDate = Get-ItemFieldValue -Item $plan.Item -FieldName 'Fecha de completado'
                $issue = Update-ManagedIssue -Context $Context -ProjectState $ProjectState -Task $task -Issue $plan.Issue -EffectiveAssignee $Assignees[$task.id] -CurrentDate $currentDate -CurrentCompletedDate $currentCompletedDate -CurrentBlockers $plan.Blockers -IssueNumbers $IssueNumbers
                Write-Host "Actualizado $($task.id), Issue #$($issue.number)."
            }
            else {
                $issue = $plan.Issue
                if (-not $plan.Item) {
                    Ensure-ProjectItem -Context $Context -ProjectState $ProjectState -Issue $issue
                    Set-ProjectItemFields -Context $Context -ProjectNumber ([int]$ProjectState.number) -Task $task -IssueUrl ([string]$issue.url)
                    Write-Host "Añadido $($task.id), Issue #$($issue.number), al proyecto."
                }
                else {
                    Write-Host "Sin cambios: $($task.id), Issue #$($issue.number)."
                }
            }
            Set-TaskSyncState -Task $task -Issue $issue -EffectiveAssignee $Assignees[$task.id]
            $IssueNumbers[$task.id] = [int]$issue.number
            $successful[$task.id] = $true
        }
        catch {
            Write-Warning "$($task.id): $($_.Exception.Message) No se guardará su asociación local; revisa GitHub antes de reintentar."
        }
    }

    if ($successful.Count -gt 0) {
        Save-Tasks -Document $TasksDocument
        Write-Host "Asociaciones y huellas de $($successful.Count) tareas guardadas en tasks.yml."
    }
    Write-Host "Proyecto: $($ProjectState.url) (número $($ProjectState.number))." -ForegroundColor Green
}

try {
    $projectConfig = Read-JsonFile -Path $script:ProjectConfigPath
    $tasksDocument = Read-JsonFile -Path $script:TasksPath
    if (-not $tasksDocument.tasks) { throw 'tasks.yml debe contener una lista tasks.' }
    $orderedTasks = Get-TaskOrder -Tasks @($tasksDocument.tasks)

    $context = Get-RepoAndAuthContext -RequireWriteScopes:$Apply
    $collaborators = Get-Collaborators -Context $context
    $assignees = Resolve-Assignees -Tasks $orderedTasks -Collaborators $collaborators
    $issues = Get-AllIssues -Context $context
    $project = $null
    $projectState = $null

    if ($context.Scopes -contains 'project') {
        $projects = Get-Projects -Context $context
        $sameTitle = @($projects | Where-Object { $_.title -ceq [string]$projectConfig.title })
        if ($sameTitle.Count -gt 1) { throw "Hay varios proyectos llamados '$($projectConfig.title)'; no se harán cambios." }
        if ($sameTitle.Count -eq 1) {
            $project = $sameTitle[0]
            $projectState = Get-ProjectState -Context $context -Number ([int]$project.number)
            Assert-FieldCompatibility -ProjectState $projectState -Config $projectConfig
        }
    }
    elseif ($Apply) {
        throw "Falta el scope project; no se aplicaron cambios remotos. Ejecuta gh auth refresh -h github.com -s project."
    }
    else {
        Write-Warning 'La sesión no tiene scope project; el modo simulación no pudo consultar Projects.'
    }

    $plans = Get-Plan -Tasks $orderedTasks -Issues $issues -ProjectState $projectState -Context $context -Assignees $assignees
    Write-SyncSummary -Context $context -Project $project -Tasks $orderedTasks -Assignees $assignees -Issues $issues

    foreach ($task in $orderedTasks) {
        if ($plans[$task.id].Action -eq 'Conflict') {
            Write-Warning "$($task.id): $($plans[$task.id].Reason)"
        }
    }

    if ($Apply) {
        $numbers = @{}
        foreach ($task in $orderedTasks) {
            if ($plans[$task.id].Issue) { $numbers[$task.id] = [int]$plans[$task.id].Issue.number }
        }
        Invoke-ApplyPlan -Context $context -Config $projectConfig -OrderedTasks $orderedTasks -Plans $plans -Assignees $assignees -ProjectState $projectState -IssueNumbers $numbers -TasksDocument $tasksDocument
    }
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
