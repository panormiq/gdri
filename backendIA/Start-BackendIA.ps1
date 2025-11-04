#Requires -Version 5.1

<#
.SYNOPSIS
    Script de démarrage pour BackendIA

.DESCRIPTION
    Ce script démarre le serveur BackendIA avec des vérifications préliminaires
    et une configuration flexible.

.PARAMETER Host
    Adresse d'écoute du serveur (défaut: 0.0.0.0)

.PARAMETER Port
    Port d'écoute du serveur (défaut: 8000)

.PARAMETER Reload
    Active le rechargement automatique en cas de modification

.PARAMETER Workers
    Nombre de workers pour le serveur (défaut: 1)

.PARAMETER Dev
    Mode développement (équivalent à -Reload)

.PARAMETER SkipChecks
    Ignore les vérifications préliminaires

.EXAMPLE
    .\Start-BackendIA.ps1
    Démarre le serveur avec la configuration par défaut

.EXAMPLE
    .\Start-BackendIA.ps1 -Dev
    Démarre en mode développement avec rechargement automatique

.EXAMPLE
    .\Start-BackendIA.ps1 -Port 9000 -SkipChecks
    Démarre sur le port 9000 sans vérifications
#>

[CmdletBinding()]
param(
    [string]$Host = "0.0.0.0",
    [int]$Port = 8000,
    [switch]$Reload,
    [int]$Workers = 1,
    [switch]$Dev,
    [switch]$SkipChecks
)

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

function Test-PythonInstallation {
    Write-ColoredMessage "🔍 Vérification de Python..." -Type Info
    
    $pythonCommands = @('py', 'python', 'python3')
    
    foreach ($cmd in $pythonCommands) {
        try {
            $version = & $cmd --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-ColoredMessage "✅ Python trouvé: $cmd ($version)" -Type Success
                return $cmd
            }
        }
        catch {
            continue
        }
    }
    
    Write-ColoredMessage "❌ Python non trouvé" -Type Error
    throw "Python n'est pas installé ou accessible"
}

function Test-Dependencies {
    param([string]$PythonCmd)
    
    Write-ColoredMessage "🔍 Vérification des dépendances..." -Type Info
    
    if (-not (Test-Path "requirements.txt")) {
        Write-ColoredMessage "❌ Fichier requirements.txt non trouvé" -Type Error
        throw "requirements.txt manquant"
    }
    
    $testScript = @"
try:
    import fastapi
    import uvicorn
    import mongoengine
    import requests
    print("OK")
except ImportError as e:
    print(f"MISSING: {e}")
"@
    
    $result = & $PythonCmd -c $testScript 2>&1
    
    if ($result -match "MISSING") {
        Write-ColoredMessage "⚠️  Installation des dépendances..." -Type Warning
        & $PythonCmd -m pip install -r requirements.txt
        
        if ($LASTEXITCODE -ne 0) {
            Write-ColoredMessage "❌ Erreur lors de l'installation des dépendances" -Type Error
            throw "Installation des dépendances échouée"
        }
    }
    
    Write-ColoredMessage "✅ Dépendances vérifiées" -Type Success
}

function Test-ProjectStructure {
    Write-ColoredMessage "🔍 Vérification de la structure du projet..." -Type Info
    
    $requiredItems = @(
        "main.py",
        "app\core\config.py",
        "app\routers",
        "app\services"
    )
    
    foreach ($item in $requiredItems) {
        if (-not (Test-Path $item)) {
            Write-ColoredMessage "❌ Élément manquant: $item" -Type Error
            throw "Structure de projet invalide"
        }
    }
    
    Write-ColoredMessage "✅ Structure du projet validée" -Type Success
}

function Test-MongoDB {
    param([string]$PythonCmd)
    
    Write-ColoredMessage "🔍 Vérification de MongoDB..." -Type Info
    
    $testScript = @"
try:
    from app.core.config import settings
    from mongoengine import connect
    connect(host=settings.database_url, serverSelectionTimeoutMS=3000)
    print("OK")
except Exception as e:
    print(f"ERROR: {e}")
"@
    
    $result = & $PythonCmd -c $testScript 2>&1
    
    if ($result -match "OK") {
        Write-ColoredMessage "✅ MongoDB accessible" -Type Success
        return $true
    }
    else {
        Write-ColoredMessage "⚠️  MongoDB non accessible - vérifiez la configuration" -Type Warning
        return $false
    }
}

function Test-Ollama {
    Write-ColoredMessage "🔍 Vérification d'Ollama..." -Type Info
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-ColoredMessage "✅ Ollama accessible" -Type Success
            return $true
        }
    }
    catch {
        Write-ColoredMessage "⚠️  Ollama non accessible - vérifiez qu'il est démarré" -Type Warning
        return $false
    }
}

function Start-BackendIAServer {
    param(
        [string]$PythonCmd,
        [string]$Host,
        [int]$Port,
        [bool]$Reload,
        [int]$Workers
    )
    
    # Construire la commande
    $args = @(
        "-m", "uvicorn",
        "main:app",
        "--host", $Host,
        "--port", $Port.ToString()
    )
    
    if ($Reload) {
        $args += "--reload"
    }
    
    if ($Workers -gt 1 -and -not $Reload) {
        $args += @("--workers", $Workers.ToString())
    }
    
    Write-ColoredMessage "🚀 Démarrage du serveur BackendIA..." -Type Info
    Write-ColoredMessage "   📡 Host: $Host" -Type Info
    Write-ColoredMessage "   🔌 Port: $Port" -Type Info
    Write-ColoredMessage "   🔄 Reload: $Reload" -Type Info
    Write-ColoredMessage "   👥 Workers: $Workers" -Type Info
    Write-Host ""
    
    Write-ColoredMessage "ℹ️  Commande: $PythonCmd $($args -join ' ')" -Type Info
    Write-Host ""
    Write-ColoredMessage "✅ 🚀 Serveur BackendIA en cours de démarrage..." -Type Success
    Write-Host ""
    Write-ColoredMessage "ℹ️  📖 Documentation: http://${Host}:${Port}/docs" -Type Info
    Write-ColoredMessage "ℹ️  🏥 Health check: http://${Host}:${Port}/health" -Type Info
    Write-Host ""
    Write-ColoredMessage "ℹ️  Appuyez sur Ctrl+C pour arrêter" -Type Info
    Write-Host ""
    
    try {
        & $PythonCmd @args
    }
    catch {
        Write-ColoredMessage "❌ Erreur lors du démarrage: $_" -Type Error
        throw
    }
}

# Script principal
try {
    # Mode développement
    if ($Dev) {
        $Reload = $true
        $Workers = 1
    }
    
    Write-Host ""
    Write-ColoredMessage "🌟 BACKENDIA - DÉMARRAGE DU SERVEUR" -Type Title
    Write-ColoredMessage "==================================" -Type Title
    Write-Host ""
    
    # Trouver Python
    $pythonCmd = Test-PythonInstallation
    
    # Vérifications
    if (-not $SkipChecks) {
        Write-ColoredMessage "ℹ️  Exécution des vérifications préliminaires..." -Type Info
        
        Test-ProjectStructure
        Test-Dependencies -PythonCmd $pythonCmd
        
        # Vérifications optionnelles
        $mongoOk = Test-MongoDB -PythonCmd $pythonCmd
        $ollamaOk = Test-Ollama
        
        Write-Host ""
        Write-ColoredMessage "✅ Vérifications terminées" -Type Success
        
        if (-not $mongoOk -or -not $ollamaOk) {
            Write-ColoredMessage "⚠️  Certains services ne sont pas accessibles, mais le serveur peut démarrer" -Type Warning
        }
    }
    else {
        Write-ColoredMessage "ℹ️  Vérifications ignorées (-SkipChecks)" -Type Info
    }
    
    Write-Host ""
    Write-ColoredMessage "==================================" -Type Title
    if ($Dev) {
        Write-ColoredMessage "🛠️  Mode: Développement" -Type Info
    }
    Write-ColoredMessage "==================================" -Type Title
    Write-Host ""
    
    # Démarrer le serveur
    Start-BackendIAServer -PythonCmd $pythonCmd -Host $Host -Port $Port -Reload $Reload -Workers $Workers
}
catch {
    Write-ColoredMessage "❌ Erreur fatale: $_" -Type Error
    exit 1
}
finally {
    Write-Host ""
    Write-ColoredMessage "🛑 Arrêt du serveur BackendIA" -Type Warning
}


