<#
.SYNOPSIS
    Módulo de utilitários e funções compartilhadas para o sistema de backups do HoraCerta.
.DESCRIPTION
    Contém a lógica oficial de resolução e garantia de nomes de arquivo seguros (anti-colisão/anti-sobrescrita),
    utilizada tanto pelo script principal backup-database.ps1 quanto pela suíte de testes test-backup-security.ps1.
#>

Set-StrictMode -Version Latest

function Resolve-SafeBackupTarget {
    <#
    .SYNOPSIS
        Calcula o caminho do arquivo de backup e manifesto garantindo que nenhum arquivo existente seja sobrescrito.
    #>
    param (
        [Parameter(Mandatory = $true)]
        [string]$TargetDir,

        [Parameter(Mandatory = $false)]
        [datetime]$Timestamp = (Get-Date),

        [Parameter(Mandatory = $false)]
        [string]$BasePrefix = "horacerta"
    )

    $timeStr = $Timestamp.ToString("yyyy-MM-dd_HHmmss")
    $primaryId = "${BasePrefix}_${timeStr}"

    $candidateBackup = Join-Path $TargetDir "$primaryId.backup"
    $candidateManifest = Join-Path $TargetDir "$primaryId.manifest.json"

    # Se nenhum dos arquivos existir no destino, o identificador primário é seguro
    if ((-not (Test-Path $candidateBackup)) -and (-not (Test-Path $candidateManifest))) {
        return [PSCustomObject]@{
            BackupId       = $primaryId
            BackupFilePath = $candidateBackup
            ManifestPath   = $candidateManifest
            HadCollision   = $false
        }
    }

    # Se já existir arquivo no mesmo segundo, resolver colisão com sufixo determinístico único
    $counter = 1
    $chosenId = $null
    $chosenBackup = $null
    $chosenManifest = $null

    do {
        $uniqueSuffix = "$($PID)_$counter"
        $chosenId = "${BasePrefix}_${timeStr}_${uniqueSuffix}"
        $chosenBackup = Join-Path $TargetDir "$chosenId.backup"
        $chosenManifest = Join-Path $TargetDir "$chosenId.manifest.json"
        $counter++
    } while ((Test-Path $chosenBackup) -or (Test-Path $chosenManifest))

    return [PSCustomObject]@{
        BackupId       = $chosenId
        BackupFilePath = $chosenBackup
        ManifestPath   = $chosenManifest
        HadCollision   = $true
    }
}

