# ============================================
# Script de monitoring pour détecter les attaques SYN flood
# ============================================
# 
# Ce script analyse les logs Apache et les connexions réseau
# pour détecter les patterns d'attaque SYN flood
#
# Usage :
#   PowerShell -ExecutionPolicy Bypass -File .\monitor-syn-flood.ps1
#   PowerShell -ExecutionPolicy Bypass -File .\monitor-syn-flood.ps1 -Continuous
#
# ============================================

param(
    [switch]$Continuous = $false,
    [int]$Interval = 30  # Intervalle en secondes pour le mode continu
)

# Couleurs pour l'affichage
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Monitoring Anti-SYN Flood" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Fonction pour analyser les connexions réseau
function Analyze-NetworkConnections {
    Write-Host "📡 Analyse des connexions réseau..." -ForegroundColor Yellow
    
    try {
        # Obtenir les connexions TCP en état SYN_RECEIVED (symptôme de SYN flood)
        $synConnections = Get-NetTCPConnection -State Listen,Established,SynReceived -ErrorAction SilentlyContinue | 
            Group-Object -Property RemoteAddress | 
            Select-Object Count, Name | 
            Sort-Object Count -Descending | 
            Select-Object -First 10
        
        if ($synConnections) {
            Write-Host "  Top 10 des IPs avec le plus de connexions :" -ForegroundColor Gray
            foreach ($conn in $synConnections) {
                if ($conn.Count -gt 10) {
                    Write-Host "    ⚠️  $($conn.Name) : $($conn.Count) connexions" -ForegroundColor Red
                } else {
                    Write-Host "    ✓ $($conn.Name) : $($conn.Count) connexions" -ForegroundColor Green
                }
            }
        }
        
        # Compter les connexions en état SYN_RECEIVED (suspect)
        $synReceived = (Get-NetTCPConnection -State SynReceived -ErrorAction SilentlyContinue).Count
        if ($synReceived -gt 50) {
            Write-Host "  🚨 ALERTE : $synReceived connexions en état SYN_RECEIVED (possible SYN flood)!" -ForegroundColor Red
        } elseif ($synReceived -gt 20) {
            Write-Host "  ⚠️  ATTENTION : $synReceived connexions en état SYN_RECEIVED" -ForegroundColor Yellow
        } else {
            Write-Host "  ✓ Connexions SYN_RECEIVED : $synReceived (normal)" -ForegroundColor Green
        }
        
        # Compter les connexions TIME_WAIT (connexions récemment fermées)
        $timeWait = (Get-NetTCPConnection -State TimeWait -ErrorAction SilentlyContinue).Count
        if ($timeWait -gt 1000) {
            Write-Host "  ⚠️  ATTENTION : $timeWait connexions en état TIME_WAIT (beaucoup de connexions fermées)" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Host "  ❌ Erreur lors de l'analyse des connexions : $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

# Fonction pour analyser les logs Apache
function Analyze-ApacheLogs {
    $logPath = "C:\xampp\apache\logs\gdri-ssl-access.log"
    $errorLogPath = "C:\xampp\apache\logs\gdri-ssl-error.log"
    
    if (-not (Test-Path $logPath)) {
        Write-Host "⚠️  Fichier de log non trouvé : $logPath" -ForegroundColor Yellow
        return
    }
    
    Write-Host "📋 Analyse des logs Apache..." -ForegroundColor Yellow
    
    try {
        # Analyser les 100 dernières lignes du log d'accès
        $recentLogs = Get-Content $logPath -Tail 100 -ErrorAction SilentlyContinue
        
        if ($recentLogs) {
            # Compter les requêtes par IP
            $ipCounts = $recentLogs | 
                ForEach-Object { if ($_ -match '^(\S+)') { $matches[1] } } | 
                Group-Object | 
                Select-Object Count, Name | 
                Sort-Object Count -Descending | 
                Select-Object -First 10
            
            Write-Host "  Top 10 des IPs dans les logs récents :" -ForegroundColor Gray
            foreach ($ip in $ipCounts) {
                if ($ip.Count -gt 50) {
                    Write-Host "    🚨 $($ip.Name) : $($ip.Count) requêtes (SUSPECT)" -ForegroundColor Red
                } elseif ($ip.Count -gt 20) {
                    Write-Host "    ⚠️  $($ip.Name) : $($ip.Count) requêtes" -ForegroundColor Yellow
                } else {
                    Write-Host "    ✓ $($ip.Name) : $($ip.Count) requêtes" -ForegroundColor Green
                }
            }
            
            # Détecter les codes d'erreur 429 (Too Many Requests - rate limiting)
            $rateLimitErrors = ($recentLogs | Select-String -Pattern ' 429 ').Count
            if ($rateLimitErrors -gt 0) {
                Write-Host "  ⚠️  $rateLimitErrors requêtes bloquées par rate limiting (429)" -ForegroundColor Yellow
            }
            
            # Détecter les codes d'erreur 503 (Service Unavailable - possible surcharge)
            $serviceUnavailable = ($recentLogs | Select-String -Pattern ' 503 ').Count
            if ($serviceUnavailable -gt 10) {
                Write-Host "  🚨 ALERTE : $serviceUnavailable erreurs 503 (Service Unavailable)!" -ForegroundColor Red
            }
        }
        
        # Analyser le log d'erreur
        if (Test-Path $errorLogPath) {
            $recentErrors = Get-Content $errorLogPath -Tail 50 -ErrorAction SilentlyContinue
            $errorCount = ($recentErrors | Measure-Object -Line).Lines
            if ($errorCount -gt 0) {
                Write-Host "  ⚠️  $errorCount erreurs récentes dans le log d'erreur" -ForegroundColor Yellow
            }
        }
        
    } catch {
        Write-Host "  ❌ Erreur lors de l'analyse des logs : $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

# Fonction pour vérifier l'état du serveur
function Check-ServerStatus {
    Write-Host "🔍 Vérification de l'état du serveur..." -ForegroundColor Yellow
    
    # Vérifier si Apache est en cours d'exécution
    $apacheProcess = Get-Process -Name "httpd" -ErrorAction SilentlyContinue
    if ($apacheProcess) {
        Write-Host "  ✓ Apache est en cours d'exécution (PID: $($apacheProcess.Id))" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Apache n'est pas en cours d'exécution!" -ForegroundColor Red
    }
    
    # Vérifier si Node.js backend est en cours d'exécution
    $nodeProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($nodeProcess) {
        Write-Host "  ✓ Node.js backend est en cours d'exécution (PID: $($nodeProcess.Id))" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Node.js backend n'est pas en cours d'exécution" -ForegroundColor Yellow
    }
    
    # Vérifier l'utilisation CPU
    $cpu = Get-Counter '\Processor(_Total)\% Processor Time' -ErrorAction SilentlyContinue
    if ($cpu) {
        $cpuValue = [math]::Round($cpu.CounterSamples[0].CookedValue, 2)
        if ($cpuValue -gt 90) {
            Write-Host "  🚨 ALERTE : CPU à $cpuValue% (surcharge possible)!" -ForegroundColor Red
        } elseif ($cpuValue -gt 70) {
            Write-Host "  ⚠️  ATTENTION : CPU à $cpuValue%" -ForegroundColor Yellow
        } else {
            Write-Host "  ✓ CPU : $cpuValue%" -ForegroundColor Green
        }
    }
    
    # Vérifier l'utilisation mémoire
    $memory = Get-Counter '\Memory\Available MBytes' -ErrorAction SilentlyContinue
    if ($memory) {
        $memAvailable = [math]::Round($memory.CounterSamples[0].CookedValue, 0)
        if ($memAvailable -lt 500) {
            Write-Host "  🚨 ALERTE : Mémoire disponible : ${memAvailable}MB (faible)!" -ForegroundColor Red
        } elseif ($memAvailable -lt 1000) {
            Write-Host "  ⚠️  ATTENTION : Mémoire disponible : ${memAvailable}MB" -ForegroundColor Yellow
        } else {
            Write-Host "  ✓ Mémoire disponible : ${memAvailable}MB" -ForegroundColor Green
        }
    }
    
    Write-Host ""
}

# Fonction principale
function Start-Monitoring {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "🕐 $timestamp" -ForegroundColor Cyan
    Write-Host "--------------------------------------------" -ForegroundColor Cyan
    
    Check-ServerStatus
    Analyze-NetworkConnections
    Analyze-ApacheLogs
    
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
}

# Exécution
if ($Continuous) {
    Write-Host "Mode continu activé (intervalle : $Interval secondes)" -ForegroundColor Yellow
    Write-Host "Appuyez sur Ctrl+C pour arrêter" -ForegroundColor Yellow
    Write-Host ""
    
    while ($true) {
        Start-Monitoring
        Start-Sleep -Seconds $Interval
    }
} else {
    Start-Monitoring
    Write-Host "💡 Pour un monitoring continu, utilisez :" -ForegroundColor Yellow
    Write-Host "   .\monitor-syn-flood.ps1 -Continuous" -ForegroundColor White
    Write-Host ""
}


