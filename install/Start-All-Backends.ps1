#Requires -Version 5.1

<#
.SYNOPSIS
    Script de démarrage pour tous les backends GDRI

.DESCRIPTION
    Ce script démarre tous les backends nécessaires :
    - GDRI Backend (Node.js) - Port 3000
    - BackendIA (Python/FastAPI) - Port 8000
    - doc_template Backend (Node.js) - Port 5005
    - lostingame Backend (Node.js) - Port 5001
    - Security Monitor

.EXAMPLE
    .\Start-All-Backends.ps1
    Démarre tous les backends en parallèle
#>

# Configuration des couleurs
$Colors = @{
    Info    = 'Cyan'
    Success = 'Green'
    Warning = 'Yellow'
    Error   = 'Red'
    Title   = 'Magenta'
}

function Write-ColoredMessage {
    param(
        [string]$Message,
        [string]$Type = 'Info'
    )
    $color = $Colors[$Type]
    Write-Host $Message -ForegroundColor $color
}

# Variables globales pour les processus
$global:Processes = @{}
$global:Jobs = @{}

# Chemins des projets
$projectRoot = Split-Path -Parent $PSScriptRoot
$gdriBackend = Join-Path $projectRoot "backend"
$backendIA = Join-Path $projectRoot "backendIA"
$docTemplateBackend = "C:\xampp\htdocs\continue\doc_template\backend"
$lostingameBackend = "C:\xampp\htdocs\lostingame\backend"

# Fonction pour arrêter tous les processus
function Stop-AllBackends {
    Write-ColoredMessage "`n🛑 Arrêt de tous les backends..." -Type Warning
    
    # Arrêter tous les jobs
    foreach ($jobName in $global:Jobs.Keys) {
        Write-ColoredMessage "  Arrêt de $jobName..." -Type Info
        Stop-Job -Job $global:Jobs[$jobName] -ErrorAction SilentlyContinue
        Remove-Job -Job $global:Jobs[$jobName] -ErrorAction SilentlyContinue
    }
    
    # Arrêter tous les processus
    foreach ($procName in $global:Processes.Keys) {
        Write-ColoredMessage "  Arrêt de $procName..." -Type Info
        if ($global:Processes[$procName] -and -not $global:Processes[$procName].HasExited) {
            Stop-Process -Id $global:Processes[$procName].Id -Force -ErrorAction SilentlyContinue
        }
    }
    
    Write-ColoredMessage "✅ Tous les backends sont arrêtés" -Type Success
}

# Fonction pour démarrer le backend GDRI
function Start-GDRIBackend {
    Write-ColoredMessage "🚀 Démarrage GDRI Backend (Port 3000)..." -Type Info
    
    $job = Start-Job -ScriptBlock {
        param($path)
        Set-Location $path
        node server.js
    } -ArgumentList $gdriBackend
    
    $global:Jobs["GDRI Backend"] = $job
    
    Start-Sleep -Seconds 2
    Write-ColoredMessage "  ✅ GDRI Backend démarré (Job ID: $($job.Id))" -Type Success
}

# Fonction pour démarrer BackendIA
function Start-BackendIA {
    Write-ColoredMessage "🚀 Démarrage BackendIA (Port 8000)..." -Type Info
    
    if (-not (Test-Path $backendIA)) {
        Write-ColoredMessage "  ⚠️  BackendIA non trouvé à $backendIA" -Type Warning
        return
    }
    
    $job = Start-Job -ScriptBlock {
        param($path)
        Set-Location $path
        python -m uvicorn main:app --host 0.0.0.0 --port 8000
    } -ArgumentList $backendIA
    
    $global:Jobs["BackendIA"] = $job
    
    Start-Sleep -Seconds 2
    Write-ColoredMessage "  ✅ BackendIA démarré (Job ID: $($job.Id))" -Type Success
}

# Fonction pour démarrer doc_template Backend
function Start-DocTemplateBackend {
    Write-ColoredMessage "🚀 Démarrage doc_template Backend (Port 5005)..." -Type Info
    
    if (-not (Test-Path $docTemplateBackend)) {
        Write-ColoredMessage "  ⚠️  doc_template Backend non trouvé à $docTemplateBackend" -Type Warning
        Write-ColoredMessage "  💡 Vérifiez le chemin dans le script" -Type Info
        return
    }
    
    $job = Start-Job -ScriptBlock {
        param($path)
        Set-Location $path
        node server.js
    } -ArgumentList $docTemplateBackend
    
    $global:Jobs["doc_template Backend"] = $job
    
    Start-Sleep -Seconds 2
    Write-ColoredMessage "  ✅ doc_template Backend démarré (Job ID: $($job.Id))" -Type Success
}

# Fonction pour démarrer lostingame Backend
function Start-LostingameBackend {
    Write-ColoredMessage "🚀 Démarrage lostingame Backend (Port 5001)..." -Type Info
    
    if (-not (Test-Path $lostingameBackend)) {
        Write-ColoredMessage "  ⚠️  lostingame Backend non trouvé à $lostingameBackend" -Type Warning
        Write-ColoredMessage "  💡 Vérifiez le chemin dans le script" -Type Info
        return
    }
    
    $job = Start-Job -ScriptBlock {
        param($path)
        Set-Location $path
        node server.js
    } -ArgumentList $lostingameBackend
    
    $global:Jobs["lostingame Backend"] = $job
    
    Start-Sleep -Seconds 2
    Write-ColoredMessage "  ✅ lostingame Backend démarré (Job ID: $($job.Id))" -Type Success
}

# Fonction pour démarrer Security Monitor
function Start-SecurityMonitor {
    Write-ColoredMessage "🚀 Démarrage Security Monitor..." -Type Info
    
    $job = Start-Job -ScriptBlock {
        param($path)
        Set-Location $path
        node backend/security-monitor.js
    } -ArgumentList $projectRoot
    
    $global:Jobs["Security Monitor"] = $job
    
    Start-Sleep -Seconds 2
    Write-ColoredMessage "  ✅ Security Monitor démarré (Job ID: $($job.Id))" -Type Success
}

# Fonction pour afficher le statut des backends
function Show-Status {
    Write-Host ""
    Write-ColoredMessage "📊 Statut des backends:" -Type Title
    Write-Host ""
    
    foreach ($jobName in $global:Jobs.Keys) {
        $job = $global:Jobs[$jobName]
        $state = $job.State
        $color = if ($state -eq "Running") { "Success" } else { "Warning" }
        Write-ColoredMessage "  $jobName : $state (Job ID: $($job.Id))" -Type $color
    }
    Write-Host ""
}

# Fonction pour surveiller les logs
function Watch-Logs {
    Write-Host ""
    Write-ColoredMessage "📋 Surveillance des logs (Ctrl+C pour arrêter)..." -Type Info
    Write-Host ""
    
    while ($true) {
        Clear-Host
        Show-Status
        
        # Afficher les dernières lignes de chaque job
        foreach ($jobName in $global:Jobs.Keys) {
            $job = $global:Jobs[$jobName]
            if ($job.State -eq "Running") {
                $output = Receive-Job -Job $job -ErrorAction SilentlyContinue | Select-Object -Last 3
                if ($output) {
                    Write-ColoredMessage "`n📝 $jobName (dernières lignes):" -Type Info
                    $output | ForEach-Object { Write-Host "  $_" }
                }
            }
        }
        
        Start-Sleep -Seconds 5
    }
}

# Gestion de l'arrêt propre
Register-EngineEvent PowerShell.Exiting -Action {
    Stop-AllBackends
} | Out-Null

# Script principal
try {
    Write-Host ""
    Write-ColoredMessage "🌟 DÉMARRAGE DE TOUS LES BACKENDS GDRI" -Type Title
    Write-ColoredMessage "========================================" -Type Title
    Write-Host ""
    
    # Vérifier les prérequis
    Write-ColoredMessage "🔍 Vérification des prérequis..." -Type Info
    
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-ColoredMessage "❌ Node.js n'est pas installé ou n'est pas dans le PATH" -Type Error
        exit 1
    }
    Write-ColoredMessage "  ✅ Node.js trouvé" -Type Success
    
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
        Write-ColoredMessage "  ⚠️  Python non trouvé (BackendIA ne pourra pas démarrer)" -Type Warning
    } else {
        Write-ColoredMessage "  ✅ Python trouvé" -Type Success
    }
    
    Write-Host ""
    
    # Démarrer tous les backends
    Start-GDRIBackend
    Start-Sleep -Seconds 1
    
    Start-BackendIA
    Start-Sleep -Seconds 1
    
    Start-DocTemplateBackend
    Start-Sleep -Seconds 1
    
    Start-LostingameBackend
    Start-Sleep -Seconds 1
    
    Start-SecurityMonitor
    
    Write-Host ""
    Write-ColoredMessage "========================================" -Type Title
    Write-ColoredMessage "✅ Tous les backends sont en cours de démarrage" -Type Success
    Write-ColoredMessage "========================================" -Type Title
    Write-Host ""
    
    # Attendre un peu pour que tout démarre
    Start-Sleep -Seconds 3
    
    # Afficher le statut
    Show-Status
    
    Write-ColoredMessage "💡 Commandes utiles:" -Type Info
    Write-Host "  - Recevoir-Job -Job `$global:Jobs['GDRI Backend'] : Voir les logs d'un backend"
    Write-Host "  - Stop-Job -Job `$global:Jobs['GDRI Backend'] : Arrêter un backend"
    Write-Host "  - Appuyez sur Ctrl+C pour arrêter tous les backends"
    Write-Host ""
    
    # Surveiller les logs
    Write-ColoredMessage "Appuyez sur Ctrl+C pour arrêter tous les backends..." -Type Warning
    Write-Host ""
    
    # Boucle principale pour surveiller
    while ($true) {
        Start-Sleep -Seconds 10
        
        # Vérifier si des jobs ont échoué
        foreach ($jobName in $global:Jobs.Keys) {
            $job = $global:Jobs[$jobName]
            if ($job.State -eq "Failed") {
                Write-ColoredMessage "❌ $jobName a échoué !" -Type Error
                $error = Receive-Job -Job $job -ErrorAction SilentlyContinue
                if ($error) {
                    Write-Host $error
                }
            }
        }
    }
}
catch {
    Write-ColoredMessage "❌ Erreur fatale: $_" -Type Error
    Stop-AllBackends
    exit 1
}
finally {
    Stop-AllBackends
}


