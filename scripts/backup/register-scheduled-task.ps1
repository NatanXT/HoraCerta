<#
.SYNOPSIS
    Script para registrar, atualizar ou consultar a tarefa de backup automatico
    no Agendador de Tarefas do Windows (Task Scheduler).
.DESCRIPTION
    Configura a tarefa diaria "HoraCerta-Backup-Diario" para executar as 20:00.
    Permite customizar horario, desregistrar (-Unregister) e consultar status detalhado (-Status).
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [string]$TaskName = "HoraCerta-Backup-Diario",

    [Parameter(Mandatory = $false)]
    [string]$DailyTime = "20:00",

    [Parameter(Mandatory = $false)]
    [string]$BackupScriptPath = "",

    [Parameter(Mandatory = $false)]
    [switch]$Unregister,

    [Parameter(Mandatory = $false)]
    [switch]$RunNow,

    [Parameter(Mandatory = $false)]
    [switch]$Status
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $BackupScriptPath) {
    if ($PSScriptRoot) {
        $BackupScriptPath = Join-Path $PSScriptRoot "backup-database.ps1"
    } else {
        $BackupScriptPath = "scripts\backup\backup-database.ps1"
    }
}

$fullScriptPath = (Resolve-Path $BackupScriptPath -ErrorAction SilentlyContinue)
if (-not $fullScriptPath) {
    throw "Script de backup nao encontrado em: $BackupScriptPath"
}
$fullScriptPath = $fullScriptPath.Path

Write-Host "=========================================================="
Write-Host "AGENDADOR DE TAREFAS -- BACKUP AUTOMATICO HORA CERTA"
Write-Host "Nome da Tarefa: $TaskName"
Write-Host "=========================================================="

function Get-TaskStatusInfo {
    try {
        $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        return $existing
    } catch {
        return $null
    }
}

$task = Get-TaskStatusInfo

# 1. Consulta de status e auditoria completa
if ($Status) {
    if ($task) {
        $info = Get-ScheduledTaskInfo -TaskName $TaskName
        $principalInfo = $task.Principal
        $settingsInfo = $task.Settings

        Write-Host "--- AUDITORIA DA TAREFA AGENDADA ---" -ForegroundColor Cyan
        Write-Host "Estado da Tarefa:     $($task.State)" -ForegroundColor Green
        Write-Host "Conta Executora:      $($principalInfo.UserId)"
        Write-Host "Tipo de Logon:        $($principalInfo.LogonType) (Sessao Interativa)"
        Write-Host "Ultima Execucao:      $($info.LastRunTime)"
        Write-Host "Codigo Ultimo Result: $($info.LastTaskResult)"
        Write-Host "Proxima Execucao:     $($info.NextRunTime)"
        Write-Host "StartWhenAvailable:   $($settingsInfo.StartWhenAvailable)"
        Write-Host "MultipleInstances:    $($settingsInfo.MultipleInstances)"
        Write-Host "------------------------------------"

        $backupDir = Join-Path $env:LOCALAPPDATA "HoraCerta\Backups"
        if (Test-Path $backupDir) {
            Write-Host "Permissoes NTFS reais da pasta de backups ($backupDir):"
            $acl = Get-Acl $backupDir
            $acl.Access | Select-Object IdentityReference, FileSystemRights, AccessControlType, IsInherited | Format-Table -AutoSize | Out-String | Write-Host
        }

        Write-Host "LIMITACAO TECNICA DOCUMENTADA:" -ForegroundColor Yellow
        Write-Host "Como a tarefa utiliza LogonType Interactive (sem exigir armazenamento de credenciais"
        Write-Host "em texto plano), ela executa quando houver sessao do usuario ativa ou bloqueada."
        Write-Host "Gracas a flag StartWhenAvailable=True, se a maquina estiver desligada as 20:00, o backup"
        Write-Host "sera iniciado assim que o sistema for ligado e a sessao do usuario iniciada."
    } else {
        Write-Host "A tarefa '$TaskName' NAO esta registrada no Agendador de Tarefas." -ForegroundColor Yellow
    }
    return
}

# 2. Desregistro (-Unregister)
if ($Unregister) {
    if ($task) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Tarefa '$TaskName' desregistrada com sucesso." -ForegroundColor Green
    } else {
        Write-Host "A tarefa '$TaskName' nao foi encontrada para remocao." -ForegroundColor Yellow
    }
    return
}

# 3. Disparo Imediato (-RunNow)
if ($RunNow) {
    if (-not $task) {
        throw "Nao e possivel executar: a tarefa '$TaskName' ainda nao esta registrada."
    }
    Write-Host "Iniciando execucao manual da tarefa agendada..."
    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 3
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host "Tarefa iniciada. Status atual: $((Get-ScheduledTask -TaskName $TaskName).State)" -ForegroundColor Green
    return
}

# 4. Registro / Atualizacao da Tarefa
Write-Host "Configurando tarefa diaria as $DailyTime..."
Write-Host "Script alvo: $fullScriptPath"

$actionArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$fullScriptPath`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArgs

$timeParts = $DailyTime.Split(":")
$hours = [int]$timeParts[0]
$minutes = [int]$timeParts[1]
$triggerTime = (Get-Date).Date.AddHours($hours).AddMinutes($minutes)
$trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime

$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive

try {
    if ($task) {
        Write-Host "Atualizando tarefa existente..."
        Set-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
        Write-Host "Tarefa '$TaskName' atualizada com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "Registrando nova tarefa..."
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Rotina diaria de backup automatizado do banco de dados HoraCerta (PostgreSQL)." | Out-Null
        Write-Host "Tarefa '$TaskName' registrada com sucesso!" -ForegroundColor Green
    }

    $updatedInfo = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host "Proxima execucao agendada: $($updatedInfo.NextRunTime)" -ForegroundColor Cyan
} catch {
    Write-Error "Nao foi possivel registrar ou alterar a tarefa agendada: $_."
}
