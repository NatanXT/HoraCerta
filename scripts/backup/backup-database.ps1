<#
.SYNOPSIS
    Script de backup sob demanda do banco de dados HoraCerta (PostgreSQL 16).
.DESCRIPTION
    Executa backup consistente usando pg_dump oficial (-Fc, formato customizado).
    Protege contra execuções concorrentes via Mutex do Windows.
    Garante integridade com verificação de catálogo (pg_restore -l) e cálculo de hash SHA-256.
    Gera manifesto estruturado JSON com metadados auditáveis.
    Nunca expõe credenciais ou senhas em logs ou argumentos de linha de comando.
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [string]$BackupDir = "",

    [Parameter(Mandatory = $false)]
    [string]$EnvFile = "",

    [Parameter(Mandatory = $false)]
    [switch]$SkipIntegrityCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:logFilePath = $null

# Mutex para impedir execução concorrente
$mutexName = "Global\HoraCerta_Postgres_Backup_Mutex"
$mutex = $null
$hasLock = $false

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $formatted = "[$ts] [$Level] $Message"
    Write-Host $formatted
    if ($script:logFilePath -ne $null -and (Test-Path -Path (Split-Path -Parent $script:logFilePath))) {
        Add-Content -Path $script:logFilePath -Value $formatted -Encoding UTF8
    }
}

function Find-PgTool {
    param([string]$ToolName)

    # 1. PATH
    $cmd = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    # 2. Caminhos padrão do PostgreSQL no Windows (16, 17, 15, 14...)
    $searchPaths = @(
        "C:\Program Files\PostgreSQL\16\bin\$ToolName.exe",
        "C:\Program Files\PostgreSQL\17\bin\$ToolName.exe",
        "C:\Program Files\PostgreSQL\15\bin\$ToolName.exe",
        "C:\Program Files\PostgreSQL\*\bin\$ToolName.exe"
    )

    foreach ($pattern in $searchPaths) {
        $resolved = Resolve-Path $pattern -ErrorAction SilentlyContinue
        if ($resolved) {
            return $resolved[0].Path
        }
    }

    return $null
}

function Parse-DatabaseUrl {
    param([string]$EnvPath)

    if (-not (Test-Path $EnvPath)) {
        throw "Arquivo .env não encontrado em: $EnvPath"
    }

    $dbUrlLine = Get-Content $EnvPath | Where-Object { $_ -match "^\s*DATABASE_URL\s*=" } | Select-Object -First 1
    if (-not $dbUrlLine) {
        throw "DATABASE_URL não configurada no arquivo $EnvPath"
    }

    $rawUrl = $dbUrlLine -replace "^\s*DATABASE_URL\s*=\s*", ""
    $rawUrl = $rawUrl.Trim().Trim('"').Trim("'")

    # Formato: postgresql://user:password@host:port/database?schema=...
    $regex = "^postgres(?:ql)?:\/\/(?:(?<user>[^:@]+)(?::(?<pass>[^@]*))?@)?(?<host>[^:\/?]+)(?::(?<port>\d+))?\/(?<db>[^?]+)"
    if ($rawUrl -match $regex) {
        $user = if ($Matches['user']) { [System.Uri]::UnescapeDataString($Matches['user']) } else { "postgres" }
        $pass = if ($Matches['pass']) { [System.Uri]::UnescapeDataString($Matches['pass']) } else { "" }
        $hostName = if ($Matches['host']) { $Matches['host'] } else { "localhost" }
        $port = if ($Matches['port']) { [int]$Matches['port'] } else { 5432 }
        $db = if ($Matches['db']) { $Matches['db'] } else { "horacerta" }

        return [PSCustomObject]@{
            User     = $user
            Password = $pass
            Host     = $hostName
            Port     = $port
            Database = $db
        }
    } else {
        throw "Formato inválido de DATABASE_URL em $EnvPath"
    }
}

try {
    # 1. Concorrência: Adquirir Mutex
    try {
        $mutex = New-Object System.Threading.Mutex($false, $mutexName)
        $hasLock = $mutex.WaitOne(0, $false)
    } catch [System.Threading.AbandonedMutexException] {
        $hasLock = $true
    }

    if (-not $hasLock) {
        Write-Error "[HoraCerta Backup] Execução concorrente bloqueada: outro processo de backup já está em execução."
        exit 2
    }

    if (-not $BackupDir) {
        $BackupDir = Join-Path $env:LOCALAPPDATA "HoraCerta\Backups"
    }
    if (-not $EnvFile) {
        if ($PSScriptRoot) {
            $EnvFile = Join-Path $PSScriptRoot "..\..\backend\.env"
        } else {
            $EnvFile = "backend\.env"
        }
    }

    # 2. Configurar Diretórios e Utilitários
    $logsDir = Join-Path $BackupDir "logs"
    if (-not (Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    }
    if (-not (Test-Path $logsDir)) {
        New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
    }

    $utilsPath = if ($PSScriptRoot) { Join-Path $PSScriptRoot "backup-utils.ps1" } else { "scripts\backup\backup-utils.ps1" }
    if (Test-Path $utilsPath) {
        . $utilsPath
    }

    $now = Get-Date
    $resolvedTarget = Resolve-SafeBackupTarget -TargetDir $BackupDir -Timestamp $now -BasePrefix "horacerta"
    $backupId = $resolvedTarget.BackupId
    $finalDumpFile = $resolvedTarget.BackupFilePath
    $manifestFile = $resolvedTarget.ManifestPath

    $script:logFilePath = Join-Path $logsDir "$backupId.log"

    Write-Log "=== INÍCIO DO BACKUP HORA CERTA ===" "INFO"
    Write-Log "Backup ID: $backupId" "INFO"
    Write-Log "Diretório de destino: $BackupDir" "INFO"
    if ($resolvedTarget.HadCollision) {
        Write-Log "Colisão de horário detectada. Nome seguro gerado para evitar sobrescrita: $backupId" "WARNING"
    }

    # 3. Localizar Ferramentas PostgreSQL
    $pgDump = Find-PgTool "pg_dump"
    $pgRestore = Find-PgTool "pg_restore"

    if (-not $pgDump) {
        throw "Executável pg_dump não encontrado no PATH nem nos diretórios padrão do PostgreSQL."
    }
    if (-not $pgRestore) {
        throw "Executável pg_restore não encontrado no PATH nem nos diretórios padrão do PostgreSQL."
    }

    $pgVersionRaw = & $pgDump --version
    Write-Log "Ferramenta detectada: $pgDump ($pgVersionRaw)" "INFO"

    # 4. Ler Configurações da Conexão
    $dbConfig = Parse-DatabaseUrl -EnvPath (Resolve-Path $EnvFile).Path
    Write-Log "Alvo: Host=$($dbConfig.Host), Porta=$($dbConfig.Port), Usuário=$($dbConfig.User), Banco=$($dbConfig.Database)" "INFO"

    # 5. Definir caminhos dos arquivos com garantia de não-sobrescrita
    $tempDumpFile = Join-Path $BackupDir "$backupId.in-progress"

    if (Test-Path $finalDumpFile) {
        throw "PROTEÇÃO CONTRA SOBRESCRITA: O arquivo de destino já existe e não será substituído: $finalDumpFile"
    }

    # 6. Executar pg_dump (Formato Customizado -Fc com compressão zlib interna)
    # Proteção de credenciais: passar senha via variável de ambiente do processo PGPASSWORD
    $env:PGPASSWORD = $dbConfig.Password

    Write-Log "Executando pg_dump (-Fc, --no-owner, --no-acl)..." "INFO"

    # Argumentos com escape explícito para suportar caminhos com espaços
    $dumpArgs = @(
        "-Fc",
        "--no-owner",
        "--no-acl",
        "-h", "`"$($dbConfig.Host)`"",
        "-p", $dbConfig.Port.ToString(),
        "-U", "`"$($dbConfig.User)`"",
        "-d", "`"$($dbConfig.Database)`"",
        "-f", "`"$tempDumpFile`""
    )

    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = $pgDump
    $processInfo.Arguments = ($dumpArgs -join " ")
    $processInfo.RedirectStandardError = $true
    $processInfo.RedirectStandardOutput = $true
    $processInfo.UseShellExecute = $false
    $processInfo.CreateNoWindow = $true

    $process = [System.Diagnostics.Process]::Start($processInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    if ($process.ExitCode -ne 0) {
        if (Test-Path $tempDumpFile) {
            Remove-Item -Path $tempDumpFile -Force -ErrorAction SilentlyContinue
        }
        $cleanErr = $stderr.Trim()
        Write-Log "Falha na execução do pg_dump (ExitCode: $($process.ExitCode)): $cleanErr" "ERROR"
        throw "pg_dump falhou com código $($process.ExitCode): $cleanErr"
    }

    if (-not (Test-Path $tempDumpFile)) {
        throw "Arquivo de backup temporário não foi gerado: $tempDumpFile"
    }

    Write-Log "pg_dump concluído com sucesso." "INFO"

    # 7. Verificação de Integridade Estrutural (pg_restore -l)
    $catalogCount = 0
    if (-not $SkipIntegrityCheck) {
        Write-Log "Verificando integridade estrutural com pg_restore -l..." "INFO"

        $restoreInfo = New-Object System.Diagnostics.ProcessStartInfo
        $restoreInfo.FileName = $pgRestore
        $restoreInfo.Arguments = "-l `"$tempDumpFile`""
        $restoreInfo.RedirectStandardError = $true
        $restoreInfo.RedirectStandardOutput = $true
        $restoreInfo.UseShellExecute = $false
        $restoreInfo.CreateNoWindow = $true

        $restoreProc = [System.Diagnostics.Process]::Start($restoreInfo)
        $restoreOut = $restoreProc.StandardOutput.ReadToEnd()
        $restoreErr = $restoreProc.StandardError.ReadToEnd()
        $restoreProc.WaitForExit()

        if ($restoreProc.ExitCode -ne 0) {
            if (Test-Path $tempDumpFile) {
                Remove-Item -Path $tempDumpFile -Force -ErrorAction SilentlyContinue
            }
            Write-Log "Verificação de catálogo pg_restore falhou: $($restoreErr.Trim())" "ERROR"
            throw "Arquivo gerado não passou na validação estrutural do pg_restore."
        }

        # Contagem de entradas de catálogo (TOC)
        $lines = @($restoreOut -split "`r?`n" | Where-Object { $_.Trim() -and (-not $_.StartsWith(";")) })
        $catalogCount = $lines.Count
        Write-Log "Catálogo verificado com sucesso ($catalogCount entradas no TOC do dump)." "INFO"
    } else {
        Write-Log "AVISO: -SkipIntegrityCheck informado. Verificação estrutural ignorada." "WARNING"
    }

    # 8. Cálculo de Hash SHA-256 e Tamanho
    $fileItem = Get-Item $tempDumpFile
    $sizeBytes = $fileItem.Length
    $sizeFormatted = if ($sizeBytes -ge 1MB) {
        "{0:N2} MB" -f ($sizeBytes / 1MB)
    } elseif ($sizeBytes -ge 1KB) {
        "{0:N2} KB" -f ($sizeBytes / 1KB)
    } else {
        "$sizeBytes bytes"
    }

    $hashResult = Get-FileHash -Path $tempDumpFile -Algorithm SHA256
    $sha256 = $hashResult.Hash.ToLower()

    Write-Log "Tamanho do arquivo: $sizeFormatted ($sizeBytes bytes)" "INFO"
    Write-Log "SHA-256: $sha256" "INFO"

    # 9. Renomeação Segura (.in-progress -> .backup) SEM -Force (Garantia contra sobrescrita)
    if (Test-Path $finalDumpFile) {
        throw "PROTEÇÃO CONTRA SOBRESCRITA: Arquivo $finalDumpFile surgiu antes da renomeação final."
    }
    Move-Item -Path $tempDumpFile -Destination $finalDumpFile -ErrorAction Stop
    Write-Log "Arquivo final salvo: $finalDumpFile" "INFO"

    # 10. Geração do Manifesto Estruturado (JSON)
    $manifestStatus = if ($SkipIntegrityCheck) { "UNVERIFIED" } else { "SUCCESS" }

    $manifestData = [PSCustomObject]@{
        backupId            = $backupId
        createdAt           = $now.ToString("yyyy-MM-ddTHH:mm:ss.fffzzz")
        database            = $dbConfig.Database
        host                = $dbConfig.Host
        port                = $dbConfig.Port
        user                = $dbConfig.User
        format              = "custom-pg_dump"
        compression         = "zlib-internal"
        fileName            = [System.IO.Path]::GetFileName($finalDumpFile)
        fileSizeBytes       = $sizeBytes
        fileSizeFormatted   = $sizeFormatted
        sha256              = $sha256
        pgDumpVersion       = $pgVersionRaw.Trim()
        catalogEntriesCount = $catalogCount
        status              = $manifestStatus
    }

    $manifestJson = $manifestData | ConvertTo-Json -Depth 4
    Set-Content -Path $manifestFile -Value $manifestJson -Encoding UTF8
    Write-Log "Manifesto gerado ($manifestStatus): $manifestFile" "INFO"

    Write-Log "=== BACKUP CONCLUÍDO COM SUCESSO ===" "INFO"

    return [PSCustomObject]@{
        Success      = $true
        BackupId     = $backupId
        BackupFile   = $finalDumpFile
        ManifestFile = $manifestFile
        SizeBytes    = $sizeBytes
        SHA256       = $sha256
    }
}
catch {
    # Limpeza preventiva de arquivo temporário
    if ($tempDumpFile -and (Test-Path $tempDumpFile)) {
        Remove-Item -Path $tempDumpFile -Force -ErrorAction SilentlyContinue
    }
    Write-Log "Erro durante o backup: $_" "ERROR"
    exit 1
}
finally {
    # Limpeza de credencial em memória
    if (Test-Path env:\PGPASSWORD) {
        Remove-Item env:\PGPASSWORD -ErrorAction SilentlyContinue
    }

    # Liberação do Mutex
    if ($hasLock -and $mutex -ne $null) {
        $mutex.ReleaseMutex()
    }
    if ($mutex -ne $null) {
        $mutex.Dispose()
    }
}
