<#
.SYNOPSIS
    Script de gerenciamento de ciclo de vida e retencao de backups do HoraCerta.
.DESCRIPTION
    Aplica a politica de retencao padrao:
      - Diarios: ultimos 7 dias.
      - Semanais: 1 por semana nas ultimas 4 semanas (com calculo ISO 8601 de virada de ano).
      - Mensais: 1 por mes nos ultimos 6 meses.
      - Preservacao incondicional do ultimo backup valido.
      - Preservacao preventiva de arquivos sem manifesto confiavel.
    
    TRAVA DE SEGURANCA ABSOLUTA (ETAPA 12.0.2):
    A exclusao efetiva esta TOTALMENTE DESABILITADA.
    Mesmo que -ApplyDelete ou -Force sejam informados, o script atua
    exclusivamente em modo DRY-RUN (somente leitura), bloqueando qualquer exclusao.
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [string]$BackupDir = "",

    [Parameter(Mandatory = $false)]
    [int]$KeepDailyDays = 7,

    [Parameter(Mandatory = $false)]
    [int]$KeepWeeklyWeeks = 4,

    [Parameter(Mandatory = $false)]
    [int]$KeepMonthlyMonths = 6,

    [Parameter(Mandatory = $false)]
    [switch]$ApplyDelete,

    [Parameter(Mandatory = $false)]
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $BackupDir) {
    $BackupDir = Join-Path $env:LOCALAPPDATA "HoraCerta\Backups"
}

if (-not (Test-Path $BackupDir)) {
    Write-Warning "Diretorio de backups nao existe: $BackupDir"
    return
}

$now = Get-Date
Write-Host "=========================================================="
Write-Host "GERENCIADOR DE RETENCAO DE BACKUPS -- HORA CERTA"
Write-Host "Data de referencia: $($now.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host "Diretorio:          $BackupDir"
Write-Host "Politica:"
Write-Host "  - Diarios:  ultimos $KeepDailyDays dias"
Write-Host "  - Semanais: 1 por semana nas ultimas $KeepWeeklyWeeks semanas"
Write-Host "  - Mensais:  1 por mes nos ultimos $KeepMonthlyMonths meses"
Write-Host "  - Salvaguarda: Preservacao obrigatoria do backup mais recente"
Write-Host "MODO:               SOMENTE DRY-RUN / SIMULACAO (EXCLUSAO REAL BLOQUEADA)" -ForegroundColor Cyan
Write-Host "=========================================================="

# TRAVA DE SEGURANCA: Bloqueio estrito de exclusao
if ($ApplyDelete -or $Force) {
    Write-Host ""
    Write-Warning "[TRAVA DE SEGURANCA ATIVA] A exclusao real de backups esta DESABILITADA nesta versao (ETAPA 12.0.2)."
    Write-Warning "Os parametros -ApplyDelete / -Force foram ignorados com seguranca."
    Write-Warning "A operacao sera mantida estritamente em MODO DRY-RUN (SOMENTE LEITURA)."
    Write-Host ""
}

# Listar backups ordenados do mais recente para o mais antigo
$backupFiles = @(Get-ChildItem -Path $BackupDir -Filter "*.backup" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)

if ($backupFiles.Count -eq 0) {
    Write-Host "Nenhum arquivo .backup encontrado para avaliar em $BackupDir."
    return
}

# Limites temporais
$dailyCutoff = $now.Date.AddDays(-$KeepDailyDays)
$weeklyCutoff = $now.Date.AddDays(-($KeepWeeklyWeeks * 7))
$monthlyCutoff = $now.Date.AddMonths(-$KeepMonthlyMonths)

# Agrupamento para retencao semanal e mensal
$weeklySlots = @{}
$monthlySlots = @{}

$evaluation = @()
$isNewest = $true

foreach ($b in $backupFiles) {
    $date = $b.LastWriteTime
    $reasonsToKeep = [System.Collections.Generic.List[string]]::new()
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($b.FullName)
    $manifestPath = Join-Path $b.DirectoryName "$baseName.manifest.json"

    # 1. Salvaguarda Absoluta: O backup mais recente NUNCA pode ser expurgado
    if ($isNewest) {
        $reasonsToKeep.Add("Ultimo backup existente (salvaguarda)")
        $isNewest = $false
    }

    # 2. Salvaguarda Preventiva: Arquivo sem manifesto confiavel nao deve ser expurgado
    if (-not (Test-Path $manifestPath)) {
        $reasonsToKeep.Add("Manifesto ausente (preservado preventivamente)")
    } else {
        try {
            $manifestObj = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $shaProp = $manifestObj.PSObject.Properties['sha256']
            $statusProp = $manifestObj.PSObject.Properties['status']
            if ($null -eq $shaProp -or $null -eq $statusProp -or $statusProp.Value -ne "SUCCESS") {
                $reasonsToKeep.Add("Manifesto inconsistente (preservado preventivamente)")
            }
        } catch {
            $reasonsToKeep.Add("Manifesto com erro de parse (preservado preventivamente)")
        }
    }

    # 3. Diario (dentro dos ultimos N dias)
    if ($date -ge $dailyCutoff) {
        $reasonsToKeep.Add("Diario (< $KeepDailyDays dias)")
    }

    # 4. Semanal com calculo ISO 8601 seguro para virada de ano
    if ($date -ge $weeklyCutoff) {
        $cal = [System.Globalization.DateTimeFormatInfo]::CurrentInfo.Calendar
        $weekNum = $cal.GetWeekOfYear($date, [System.Globalization.CalendarWeekRule]::FirstFourDayWeek, [DayOfWeek]::Monday)
        $isoYear = $date.Year
        if ($weekNum -ge 52 -and $date.Month -eq 1) {
            $isoYear = $date.Year - 1
        } elseif ($weekNum -eq 1 -and $date.Month -eq 12) {
            $isoYear = $date.Year + 1
        }
        $weekKey = "$isoYear-W$("{0:D2}" -f $weekNum)"

        if (-not $weeklySlots.ContainsKey($weekKey)) {
            $weeklySlots[$weekKey] = $b.FullName
            $reasonsToKeep.Add("Semanal ($weekKey)")
        }
    }

    # 5. Mensal (1 por mes dentro dos ultimos N meses)
    if ($date -ge $monthlyCutoff) {
        $monthKey = $date.ToString("yyyy-MM")
        if (-not $monthlySlots.ContainsKey($monthKey)) {
            $monthlySlots[$monthKey] = $b.FullName
            $reasonsToKeep.Add("Mensal ($monthKey)")
        }
    }

    $keep = $reasonsToKeep.Count -gt 0
    $action = if ($keep) { "MANTER" } else { "EXCEDENTE (SIMULACAO)" }

    $evaluation += [PSCustomObject]@{
        Arquivo       = $b.Name
        Data          = $b.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
        TamanhoKB     = [math]::Round($b.Length / 1KB, 1)
        Acao          = $action
        Justificativa = if ($keep) { ($reasonsToKeep -join "; ") } else { "Fora das janelas de retencao" }
        FullPath      = $b.FullName
    }
}

# Exibir tabela de avaliacao
$evaluation | Format-Table -Property Arquivo, Data, TamanhoKB, Acao, Justificativa -AutoSize

$keepCount = @($evaluation | Where-Object { $_.Acao -eq "MANTER" }).Count
$excessCount = @($evaluation | Where-Object { $_.Acao -ne "MANTER" }).Count

Write-Host "----------------------------------------------------------"
Write-Host "Resumo: Total = $($evaluation.Count) | Manter = $keepCount | Excedentes (Simulacao) = $excessCount"

if ($excessCount -gt 0) {
    Write-Host ""
    Write-Host "[MODO SEGURO DRY-RUN ATIVO]" -ForegroundColor Cyan
    Write-Host "$excessCount arquivo(s) foram identificados como excedentes na simulacao da politica."
    Write-Host "NENHUM arquivo foi ou sera excluido. A exclusao fisica esta permanentemente desabilitada nesta versao."
} else {
    Write-Host "Nenhum backup excedente identificado. Todos os arquivos estao dentro da janela de retencao ou protegidos por salvaguardas." -ForegroundColor Green
}
