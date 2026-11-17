<#
.SYNOPSIS
    Script de verificacao rigorosa de integridade de backups do HoraCerta.
.DESCRIPTION
    Executa 10 verificacoes obrigatorias de seguranca:
      1. Arquivo .backup existente
      2. Arquivo com tamanho maior que zero (> 0 bytes)
      3. Manifesto companion existente
      4. Manifesto JSON valido e analisavel
      5. Campos obrigatorios presentes no manifesto
      6. Nome do arquivo consistente com o manifesto
      7. Tamanho em bytes estritamente coincidente com o manifesto
      8. Hash SHA-256 recalculado estritamente coincidente com o manifesto
      9. Catalogo estrutural legivel e integro via pg_restore -l
      10. Codigo de saida do pg_restore estritamente igual a zero (0)
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [string]$BackupFile,

    [Parameter(Mandatory = $false)]
    [string]$BackupDir = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $BackupDir) {
    $BackupDir = Join-Path $env:LOCALAPPDATA "HoraCerta\Backups"
}

function Find-PgTool {
    param([string]$ToolName)

    $cmd = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $searchPaths = @(
        "C:\Program Files\PostgreSQL\16\bin\$ToolName.exe",
        "C:\Program Files\PostgreSQL\17\bin\$ToolName.exe",
        "C:\Program Files\PostgreSQL\15\bin\$ToolName.exe",
        "C:\Program Files\PostgreSQL\*\bin\$ToolName.exe"
    )

    foreach ($pattern in $searchPaths) {
        $resolved = Resolve-Path $pattern -ErrorAction SilentlyContinue
        if ($resolved) { return $resolved[0].Path }
    }
    return $null
}

try {
    # 1. Identificar o arquivo de backup
    if (-not $BackupFile) {
        if (-not (Test-Path $BackupDir)) {
            throw "Diretorio de backups nao encontrado: $BackupDir"
        }
        $latest = Get-ChildItem -Path $BackupDir -Filter "*.backup" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (-not $latest) {
            throw "Nenhum arquivo .backup encontrado em $BackupDir"
        }
        $BackupFile = $latest.FullName
    }

    # CHECK 1: Arquivo .backup existente
    if (-not (Test-Path $BackupFile)) {
        throw "CHECK 1 FALHOU: Arquivo de backup nao existe: $BackupFile"
    }

    $backupItem = Get-Item $BackupFile
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($BackupFile)
    $parentDir = $backupItem.DirectoryName
    $manifestPath = Join-Path $parentDir "$baseName.manifest.json"

    Write-Host "=========================================================="
    Write-Host "VERIFICACAO DE SEGURANCA E INTEGRIDADE -- HORA CERTA"
    Write-Host "Arquivo Alvo: $($backupItem.Name)"
    Write-Host "Caminho:      $($backupItem.FullName)"
    Write-Host "Tamanho:      $($backupItem.Length) bytes"
    Write-Host "Ultima Modif: $($backupItem.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))"
    Write-Host "=========================================================="

    # CHECK 2: Arquivo maior que zero
    if ($backupItem.Length -le 0) {
        throw "CHECK 2 FALHOU: O arquivo de backup possui tamanho zero."
    }
    Write-Host "[OK] CHECK 1 e 2: Arquivo existe e nao esta vazio ($($backupItem.Length) bytes)."

    # CHECK 3: Manifesto companion existente
    if (-not (Test-Path $manifestPath)) {
        throw "CHECK 3 FALHOU: Manifesto obrigatorio companion nao encontrado: $manifestPath"
    }
    Write-Host "[OK] CHECK 3: Manifesto companion localizado ($baseName.manifest.json)."

    # CHECK 4: Manifesto JSON valido
    $manifest = $null
    try {
        $manifestContent = Get-Content $manifestPath -Raw -Encoding UTF8
        $manifest = $manifestContent | ConvertFrom-Json
    } catch {
        throw "CHECK 4 FALHOU: Manifesto corrompido ou formato JSON invalido: $_"
    }
    Write-Host "[OK] CHECK 4: Formato JSON do manifesto analisado com sucesso."

    # CHECK 5: Campos obrigatorios presentes no manifesto (seguro para StrictMode)
    $requiredFields = @("backupId", "createdAt", "database", "fileName", "fileSizeBytes", "sha256", "status")
    foreach ($field in $requiredFields) {
        $prop = $manifest.PSObject.Properties[$field]
        if ($null -eq $prop -or $null -eq $prop.Value -or [string]::IsNullOrWhiteSpace($prop.Value.ToString())) {
            throw "CHECK 5 FALHOU: Campo obrigatorio '$field' ausente ou vazio no manifesto."
        }
    }
    if ($manifest.status -ne "SUCCESS") {
        throw "CHECK 5 FALHOU: Status do manifesto e '$($manifest.status)', diferente de 'SUCCESS'."
    }
    Write-Host "[OK] CHECK 5: Todos os campos obrigatorios presentes e status = SUCCESS."

    # CHECK 6: Nome do arquivo consistente com o manifesto
    if ($manifest.fileName -ne $backupItem.Name) {
        throw "CHECK 6 FALHOU: Inconsistencia de nome. Arquivo fisico: '$($backupItem.Name)', manifesto: '$($manifest.fileName)'."
    }
    Write-Host "[OK] CHECK 6: Nome do arquivo confere com o manifesto."

    # CHECK 7: Tamanho consistente com o manifesto
    $manifestBytes = [int64]$manifest.fileSizeBytes
    if ($manifestBytes -ne $backupItem.Length) {
        throw "CHECK 7 FALHOU: Divergencia de tamanho. Fisico: $($backupItem.Length) bytes, manifesto: $manifestBytes bytes."
    }
    Write-Host "[OK] CHECK 7: Tamanho fisico identico ao registrado no manifesto ($manifestBytes bytes)."

    # CHECK 8: SHA-256 correspondente
    Write-Host "Calculando hash criptografico SHA-256..."
    $computedHash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash.ToLower()
    $expectedHash = $manifest.sha256.ToLower().Trim()

    if ($computedHash -ne $expectedHash) {
        throw "CHECK 8 FALHOU: CORRUPCAO DETECTADA! Hash calculado ($computedHash) difere do manifesto ($expectedHash)."
    }
    Write-Host "[OK] CHECK 8: Hash SHA-256 recalculado coincide perfeitamente ($computedHash)."

    # CHECK 9: Catalogo legivel pelo pg_restore -l
    $pgRestore = Find-PgTool "pg_restore"
    if (-not $pgRestore) {
        throw "CHECK 9 FALHOU: Utilitario pg_restore nao encontrado no sistema para validacao do catalogo."
    }

    Write-Host "Validando integridade estrutural do catalogo via pg_restore -l..."
    $restoreInfo = New-Object System.Diagnostics.ProcessStartInfo
    $restoreInfo.FileName = $pgRestore
    $restoreInfo.Arguments = "-l `"$BackupFile`""
    $restoreInfo.RedirectStandardError = $true
    $restoreInfo.RedirectStandardOutput = $true
    $restoreInfo.UseShellExecute = $false
    $restoreInfo.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($restoreInfo)
    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()

    # CHECK 10: Codigo de saida zero do pg_restore
    if ($proc.ExitCode -ne 0) {
        throw "CHECK 10 FALHOU: pg_restore retornou codigo de erro $($proc.ExitCode): $($stderr.Trim())"
    }

    $validLines = @($stdout -split "`r?`n" | Where-Object { $_.Trim() -and (-not $_.StartsWith(";")) })
    $tableLines = @($validLines | Where-Object { $_ -match "\sTABLE\s" })
    $dataLines = @($validLines | Where-Object { $_ -match "\sTABLE DATA\s" })

    if ($validLines.Count -eq 0) {
        throw "CHECK 9/10 FALHOU: Catalogo do dump esta vazio ou ilegivel."
    }

    Write-Host "[OK] CHECK 9 e 10: Catalogo verificado sem erros (ExitCode = 0)."
    Write-Host "Entradas no TOC:          $($validLines.Count)"
    Write-Host "Tabelas estruturais (DDL): $($tableLines.Count)"
    Write-Host "Tabelas com dados (DATA):  $($dataLines.Count)"
    Write-Host "=========================================================="
    Write-Host "STATUS: INTEGRIDADE ESTRUTURAL VALIDADA (SUCESSO)" -ForegroundColor Green
    Write-Host "NOTA: Esta validacao confirma a integridade fisica do arquivo e"
    Write-Host "a legibilidade do catalogo TOC via pg_restore -l."
    Write-Host "A RESTAURACAO COMPLETA DOS DADOS EM INSTANCIA ISOLADA permanece PENDENTE."
    Write-Host "=========================================================="

    return [PSCustomObject]@{
        Valid                  = $true
        StructuralIntegrity    = "VALIDADA"
        FullRestorationStatus  = "PENDENTE"
        BackupFile             = $BackupFile
        SizeBytes              = $backupItem.Length
        SHA256                 = $computedHash
        TOCEntries             = $validLines.Count
        TableCount             = $tableLines.Count
        DataCount              = $dataLines.Count
    }
}
catch {
    Write-Host "==========================================================" -ForegroundColor Red
    Write-Host "FALHA NA VERIFICACAO DO BACKUP: $_" -ForegroundColor Red
    Write-Host "STATUS: BACKUP NAO VALIDADO (INVALIDO OU INCOMPLETO)" -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Red
    exit 1
}
