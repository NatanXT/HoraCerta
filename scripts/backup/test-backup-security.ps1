<#
.SYNOPSIS
    Suite de testes automatizados de seguranca para o sistema de backups do HoraCerta (ETAPA 12.0.2).
.DESCRIPTION
    Executa testes rigorosos e isolados com validacao estrita de ExitCode e motivo de rejeicao:
      1. Manifesto ausente
      2. Manifesto invalido (JSON quebrado)
      3. Hash SHA-256 divergente (corrupcao simulada)
      4. Tamanho em bytes divergente
      5. Arquivo de backup inexistente
      6. Arquivo incompleto (0 bytes)
      7. Backup original valido verificado in-place (somente-leitura, sem copias)
      8. Tentativa de exclusao com -ApplyDelete (bloqueio por trava)
      9. Tentativa de exclusao com -Force (bloqueio por trava)
      10. Protecao contra sobrescrita com a funcao real Resolve-SafeBackupTarget
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$tempTestDir = Join-Path $env:TEMP "HoraCerta_Security_Tests_$($PID)_$(Get-Random)"
$verifyScript = Join-Path $PSScriptRoot "verify-backup.ps1"
$retentionScript = Join-Path $PSScriptRoot "manage-retention.ps1"
$utilsScript = Join-Path $PSScriptRoot "backup-utils.ps1"

. $utilsScript

Write-Host "=========================================================="
Write-Host "SUITE DE TESTES DE SEGURANCA DE BACKUP -- HORA CERTA"
Write-Host "Diretorio de Testes Sinteticos: $tempTestDir"
Write-Host "=========================================================="

New-Item -ItemType Directory -Path $tempTestDir -Force | Out-Null

$results = [System.Collections.Generic.List[PSCustomObject]]::new()
$failedCount = 0
$failedScenarios = [System.Collections.Generic.List[string]]::new()

function Execute-ScriptFile {
    param(
        [string]$ScriptPath,
        [string[]]$ArgumentList = @()
    )

    $procInfo = New-Object System.Diagnostics.ProcessStartInfo
    $procInfo.FileName = "powershell.exe"

    $escapedArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$ScriptPath`"")
    foreach ($arg in $ArgumentList) {
        $escapedArgs += "`"$arg`""
    }
    $procInfo.Arguments = $escapedArgs -join " "
    $procInfo.RedirectStandardOutput = $true
    $procInfo.RedirectStandardError = $true
    $procInfo.UseShellExecute = $false
    $procInfo.CreateNoWindow = $true

    $p = [System.Diagnostics.Process]::Start($procInfo)
    $stdout = $p.StandardOutput.ReadToEnd()
    $stderr = $p.StandardError.ReadToEnd()
    $p.WaitForExit()

    return [PSCustomObject]@{
        ExitCode = $p.ExitCode
        Output   = "$stdout`n$stderr"
    }
}

function Assert-Scenario {
    param(
        [string]$ScenarioName,
        [scriptblock]$Action,
        [bool]$ExpectSuccess,
        [string]$ExpectedOutputPattern
    )

    $testPassed = $false
    $failReason = ""

    try {
        $execRes = & $Action

        if ($ExpectSuccess) {
            if ($execRes.ExitCode -eq 0 -and ($execRes.Output -match $ExpectedOutputPattern)) {
                $testPassed = $true
            } else {
                $failReason = "ExitCode esperado 0 mas obteve $($execRes.ExitCode), ou padrao '$ExpectedOutputPattern' nao encontrado no output."
            }
        } else {
            # Cenário de rejeição esperado: ExitCode deve ser != 0 E o motivo deve corresponder ao padrão
            if ($execRes.ExitCode -ne 0 -and ($execRes.Output -match $ExpectedOutputPattern)) {
                $testPassed = $true
            } elseif ($execRes.ExitCode -eq 0) {
                $failReason = "Deveria ter falhado (ExitCode != 0), mas retornou 0 com sucesso indevido."
            } else {
                $failReason = "Falhou com ExitCode $($execRes.ExitCode), porem o motivo da falha nao correspondeu ao esperado ('$ExpectedOutputPattern'). Output: $($execRes.Output.Trim())"
            }
        }
    } catch {
        $failReason = "Excecao nao tratada na execucao do teste: $_"
    }

    if ($testPassed) {
        Write-Host " [PASSOU] $ScenarioName" -ForegroundColor Green
        $results.Add([PSCustomObject]@{
            Cenario   = $ScenarioName
            Esperado  = if ($ExpectSuccess) { "Sucesso (Exit 0)" } else { "Rejeicao (Exit != 0)" }
            Resultado = "PASSOU"
            Status    = "OK"
        })
    } else {
        Write-Host " [FALHOU] $ScenarioName -- $failReason" -ForegroundColor Red
        $results.Add([PSCustomObject]@{
            Cenario   = $ScenarioName
            Esperado  = if ($ExpectSuccess) { "Sucesso (Exit 0)" } else { "Rejeicao (Exit != 0)" }
            Resultado = "FALHOU"
            Status    = "ERRO ($failReason)"
        })
        $script:failedCount++
        $script:failedScenarios.Add($ScenarioName)
    }
}

try {
    # 1. Manifesto ausente
    Assert-Scenario "1. Manifesto Ausente" -ExpectSuccess $false -ExpectedOutputPattern "CHECK 3 FALHOU: Manifesto obrigatorio" -Action {
        $file = Join-Path $tempTestDir "test_nomanifest.backup"
        Set-Content -Path $file -Value "dummy binary content"
        return Execute-ScriptFile -ScriptPath $verifyScript -ArgumentList @("-BackupFile", $file)
    }

    # 2. Manifesto invalido (JSON malformado)
    Assert-Scenario "2. Manifesto Invalido (JSON malformado)" -ExpectSuccess $false -ExpectedOutputPattern "CHECK 4 FALHOU: Manifesto corrompido" -Action {
        $file = Join-Path $tempTestDir "test_badjson.backup"
        $man = Join-Path $tempTestDir "test_badjson.manifest.json"
        Set-Content -Path $file -Value "dummy binary content"
        Set-Content -Path $man -Value "{ invalid json: true, broken... "
        return Execute-ScriptFile -ScriptPath $verifyScript -ArgumentList @("-BackupFile", $file)
    }

    # 3. Hash SHA-256 divergente
    Assert-Scenario "3. Hash SHA-256 Divergente" -ExpectSuccess $false -ExpectedOutputPattern "CHECK 8 FALHOU: CORRUPCAO DETECTADA" -Action {
        $file = Join-Path $tempTestDir "test_badhash.backup"
        $man = Join-Path $tempTestDir "test_badhash.manifest.json"
        Set-Content -Path $file -Value "dummy binary content"
        $json = @{
            backupId = "test_badhash"
            createdAt = (Get-Date).ToString("o")
            database = "horacerta"
            fileName = "test_badhash.backup"
            fileSizeBytes = (Get-Item $file).Length
            sha256 = "0000000000000000000000000000000000000000000000000000000000000000"
            status = "SUCCESS"
        } | ConvertTo-Json
        Set-Content -Path $man -Value $json
        return Execute-ScriptFile -ScriptPath $verifyScript -ArgumentList @("-BackupFile", $file)
    }

    # 4. Tamanho em bytes divergente
    Assert-Scenario "4. Tamanho em Bytes Divergente" -ExpectSuccess $false -ExpectedOutputPattern "CHECK 7 FALHOU: Divergencia de tamanho" -Action {
        $file = Join-Path $tempTestDir "test_badsize.backup"
        $man = Join-Path $tempTestDir "test_badsize.manifest.json"
        Set-Content -Path $file -Value "dummy binary content"
        $hash = (Get-FileHash -Path $file -Algorithm SHA256).Hash.ToLower()
        $json = @{
            backupId = "test_badsize"
            createdAt = (Get-Date).ToString("o")
            database = "horacerta"
            fileName = "test_badsize.backup"
            fileSizeBytes = 99999999
            sha256 = $hash
            status = "SUCCESS"
        } | ConvertTo-Json
        Set-Content -Path $man -Value $json
        return Execute-ScriptFile -ScriptPath $verifyScript -ArgumentList @("-BackupFile", $file)
    }

    # 5. Backup inexistente
    Assert-Scenario "5. Arquivo de Backup Inexistente" -ExpectSuccess $false -ExpectedOutputPattern "CHECK 1 FALHOU: Arquivo de backup nao existe" -Action {
        $file = Join-Path $tempTestDir "completely_nonexistent.backup"
        return Execute-ScriptFile -ScriptPath $verifyScript -ArgumentList @("-BackupFile", $file)
    }

    # 6. Arquivo incompleto / zero bytes
    Assert-Scenario "6. Arquivo de Backup Zero Bytes (0 bytes)" -ExpectSuccess $false -ExpectedOutputPattern "CHECK 2 FALHOU: O arquivo de backup possui tamanho zero" -Action {
        $file = Join-Path $tempTestDir "test_zero.backup"
        $man = Join-Path $tempTestDir "test_zero.manifest.json"
        New-Item -ItemType File -Path $file -Force | Out-Null
        $json = @{
            backupId = "test_zero"
            createdAt = (Get-Date).ToString("o")
            database = "horacerta"
            fileName = "test_zero.backup"
            fileSizeBytes = 0
            sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
            status = "SUCCESS"
        } | ConvertTo-Json
        Set-Content -Path $man -Value $json
        return Execute-ScriptFile -ScriptPath $verifyScript -ArgumentList @("-BackupFile", $file)
    }

    # 7. Backup original valido verificado in-place (somente-leitura, sem copias)
    Assert-Scenario "7. Backup Original Valido (In-Place / Somente Leitura)" -ExpectSuccess $true -ExpectedOutputPattern "STATUS: INTEGRIDADE ESTRUTURAL VALIDADA" -Action {
        $backupDir = Join-Path $env:LOCALAPPDATA "HoraCerta\Backups"
        $realBackup = Get-ChildItem -Path $backupDir -Filter "*.backup" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (-not $realBackup) {
            throw "Nenhum backup real encontrado em $backupDir para validacao in-place."
        }
        return Execute-ScriptFile -ScriptPath $verifyScript -ArgumentList @("-BackupFile", $realBackup.FullName)
    }

    # 8. Tentativa de exclusao com -ApplyDelete (bloqueio de exclusao em dry-run)
    Assert-Scenario "8. Bloqueio de Exclusao com -ApplyDelete" -ExpectSuccess $true -ExpectedOutputPattern "TRAVA DE SEGURANCA ATIVA" -Action {
        $retentionDir = Join-Path $tempTestDir "retention_test_apply"
        New-Item -ItemType Directory -Path $retentionDir -Force | Out-Null
        $dummyOld = Join-Path $retentionDir "old_2020.backup"
        Set-Content -Path $dummyOld -Value "old backup synthetic"
        (Get-Item $dummyOld).LastWriteTime = (Get-Date).AddDays(-60)

        $res = Execute-ScriptFile -ScriptPath $retentionScript -ArgumentList @("-BackupDir", $retentionDir, "-ApplyDelete")
        if (-not (Test-Path $dummyOld)) {
            throw "FALHA CRITICA: Arquivo synthetic foi excluido com -ApplyDelete!"
        }
        return $res
    }

    # 9. Tentativa de exclusao com -Force (bloqueio de exclusao em dry-run)
    Assert-Scenario "9. Bloqueio de Exclusao com -Force" -ExpectSuccess $true -ExpectedOutputPattern "TRAVA DE SEGURANCA ATIVA" -Action {
        $retentionDir = Join-Path $tempTestDir "retention_test_force"
        New-Item -ItemType Directory -Path $retentionDir -Force | Out-Null
        $dummyOld = Join-Path $retentionDir "old_force.backup"
        Set-Content -Path $dummyOld -Value "old backup synthetic"
        (Get-Item $dummyOld).LastWriteTime = (Get-Date).AddDays(-60)

        $res = Execute-ScriptFile -ScriptPath $retentionScript -ArgumentList @("-BackupDir", $retentionDir, "-ApplyDelete", "-Force")
        if (-not (Test-Path $dummyOld)) {
            throw "FALHA CRITICA: Arquivo synthetic foi excluido com -Force!"
        }
        return $res
    }

    # 10. Protecao contra sobrescrita utilizando a funcao real Resolve-SafeBackupTarget
    Assert-Scenario "10. Protecao contra Sobrescrita (Resolve-SafeBackupTarget Real)" -ExpectSuccess $true -ExpectedOutputPattern "COLLISION_RESOLVED_SAFELY" -Action {
        $collisionDir = Join-Path $tempTestDir "collision_test"
        New-Item -ItemType Directory -Path $collisionDir -Force | Out-Null

        $fixedTime = [datetime]"2026-11-10 12:00:00"
        $expectedOriginalName = "horacerta_2026-11-10_120000.backup"
        $originalFilePath = Join-Path $collisionDir $expectedOriginalName
        $originalContent = "DADO_ORIGINAL_INTACTO_12345"
        Set-Content -Path $originalFilePath -Value $originalContent

        # Chama a funcao real utilizada pelo backup-database.ps1
        $resolved = Resolve-SafeBackupTarget -TargetDir $collisionDir -Timestamp $fixedTime -BasePrefix "horacerta"

        if (-not $resolved.HadCollision) {
            throw "Resolve-SafeBackupTarget nao detectou a colisao existente!"
        }
        if ($resolved.BackupFilePath -eq $originalFilePath) {
            throw "Resolve-SafeBackupTarget retornou o mesmo caminho existente, permitindo sobrescrita!"
        }
        if (Test-Path $resolved.BackupFilePath) {
            throw "Resolve-SafeBackupTarget retornou um caminho que tambem ja existe!"
        }

        # Simula escrita no novo arquivo gerado
        Set-Content -Path $resolved.BackupFilePath -Value "NOVO_BACKUP_CONCORRENTE"

        # Confirma que o conteudo do arquivo original continua estritamente intacto
        $persistedOriginal = Get-Content -Path $originalFilePath -Raw
        if ($persistedOriginal.Trim() -ne $originalContent) {
            throw "O conteudo do arquivo original foi corrompido ou sobrescrito!"
        }

        return [PSCustomObject]@{
            ExitCode = 0
            Output   = "COLLISION_RESOLVED_SAFELY: Arquivo original intacto, novo destino: $($resolved.BackupId)"
        }
    }

    Write-Host ""
    Write-Host "=========================================================="
    Write-Host "RESUMO DOS TESTES DE SEGURANCA DE BACKUP"
    Write-Host "=========================================================="
    $results | Format-Table -AutoSize

    $totalTests = $results.Count
    $passedTests = $totalTests - $failedCount

    Write-Host "----------------------------------------------------------"
    Write-Host "Total de Testes:    $totalTests"
    Write-Host "Total Aprovado:     $passedTests" -ForegroundColor Green
    Write-Host "Total Reprovado:    $failedCount" -ForegroundColor $(if ($failedCount -eq 0) { "Green" } else { "Red" })
    if ($failedCount -gt 0) {
        Write-Host "Cenarios Reprovados: $($failedScenarios -join ', ')" -ForegroundColor Red
        Write-Host "ExitCode Final:     1" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "Cenarios Reprovados: Nenhum" -ForegroundColor Green
        Write-Host "ExitCode Final:     0" -ForegroundColor Green
        exit 0
    }
}
finally {
    if (Test-Path $tempTestDir) {
        Remove-Item -Path $tempTestDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
