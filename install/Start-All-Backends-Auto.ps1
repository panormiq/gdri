#Requires -Version 5.1

<#
.SYNOPSIS
    Script de démarrage automatique pour tous les backends GDRI
    Fonctionne depuis n'importe où dans htdocs

.DESCRIPTION
    Ce script détecte automatiquement les chemins et démarre tous les backends :
    - GDRI Backend (Node.js) - Port 3000
    - BackendIA (Python/FastAPI) - Port 8000
    - doc_template Backend (Node.js) - Port 5005
    - lostingame Backend (Node.js) - Port 5001
    - Security Monitor

.PARAMETER ShowWindows
    Ouvre une fenêtre PowerShell séparée pour chaque backend (avec logs visibles)

.PARAMETER ShowLogs
    Affiche les logs en temps réel dans la console principale

.EXAMPLE
    .\Start-All-Backends-Auto.ps1
    Démarre tous les backends en arrière-plan (sans fenêtres)

.EXAMPLE
    .\Start-All-Backends-Auto.ps1 -ShowWindows
    Démarre tous les backends dans des fenêtres séparées (avec logs visibles)
#>

[CmdletBinding()]
param(
    [switch]$ShowWindows,
    [switch]$ShowLogs
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

# Fonction pour trouver le dossier htdocs
function Find-HtdocsRoot {
    # Si le script est dans install/, remonter d'un niveau pour trouver gdri
    # Si le script est à la racine de gdri, remonter pour trouver htdocs
    $currentPath = if ($PSScriptRoot) { $PSScriptRoot } else { Get-Location }
    
    # Si on est dans install/, remonter à gdri
    if ((Split-Path $currentPath -Leaf) -eq "install") {
        $currentPath = Split-Path $currentPath -Parent
    }
    
    # Remonter jusqu'à trouver htdocs
    while ($currentPath -and $currentPath -ne (Split-Path $currentPath -Qualifier)) {
        $parent = Split-Path $currentPath -Parent
        $folderName = Split-Path $currentPath -Leaf
        
        if ($folderName -eq "htdocs") {
            return $currentPath
        }
        
        $currentPath = $parent
    }
    
    # Si on ne trouve pas htdocs, chercher dans les emplacements courants
    $commonPaths = @(
        "C:\xampp\htdocs",
        "D:\xampp\htdocs",
        "E:\xampp\htdocs"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            return $path
        }
    }
    
    # Sinon, utiliser le répertoire courant
    return if ($PSScriptRoot) { Split-Path $PSScriptRoot -Parent } else { Get-Location }
}

# Fonction pour trouver un dossier par nom
function Find-FolderByName {
    param(
        [string]$FolderName,
        [string]$RootPath
    )
    
    $found = Get-ChildItem -Path $RootPath -Directory -Filter $FolderName -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if ($found) {
        return $found.FullName
    }
    
    return $null
}

# Fonction pour trouver un fichier par nom
function Find-FileByName {
    param(
        [string]$FileName,
        [string]$RootPath
    )
    
    $found = Get-ChildItem -Path $RootPath -File -Filter $FileName -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if ($found) {
        return $found.DirectoryName
    }
    
    return $null
}

# Détection automatique des chemins
Write-ColoredMessage "🔍 Détection automatique des chemins..." -Type Info

$htdocsRoot = Find-HtdocsRoot
Write-ColoredMessage "  📁 Dossier htdocs détecté: $htdocsRoot" -Type Success

# Chemins des projets
$gdriRoot = Find-FolderByName "gdri" $htdocsRoot
if (-not $gdriRoot) {
    # Essayer de trouver par server.js
    $gdriRoot = Find-FileByName "server.js" $htdocsRoot | Where-Object { $_ -like "*gdri*" } | Select-Object -First 1
}

$backendIA = $null
if ($gdriRoot) {
    $backendIA = Join-Path $gdriRoot "backendIA"
    if (-not (Test-Path $backendIA)) {
        $backendIA = $null
    }
}

# Chercher doc_template de plusieurs façons
$docTemplateBackend = $null

# Méthode 1 : Chercher le dossier doc_template directement (PRIORITÉ au dossier back)
$docTemplateRoot = Find-FolderByName "doc_template" $htdocsRoot
if ($docTemplateRoot) {
    # TOUJOURS chercher d'abord dans le dossier back (pas backend pour doc_template)
    $backPath = Join-Path $docTemplateRoot "back"
    if (Test-Path $backPath) {
        # Vérifier qu'il y a au moins server.js ou package.json dans back
        $hasServer = Test-Path (Join-Path $backPath "server.js")
        $hasPackage = Test-Path (Join-Path $backPath "package.json")
        if ($hasServer -or $hasPackage) {
            $docTemplateBackend = $backPath
        }
    }
    
    # Si back n'existe pas, essayer backend (fallback)
    if (-not $docTemplateBackend) {
        $backendPath = Join-Path $docTemplateRoot "backend"
        if (Test-Path $backendPath) {
            $hasServer = Test-Path (Join-Path $backendPath "server.js")
            $hasPackage = Test-Path (Join-Path $backendPath "package.json")
            if ($hasServer -or $hasPackage) {
                $docTemplateBackend = $backendPath
            }
        }
    }
    
    # Si ni back ni backend n'existent, chercher directement dans doc_template (fallback)
    if (-not $docTemplateBackend) {
        $serverInRoot = Test-Path (Join-Path $docTemplateRoot "server.js")
        $packageInRoot = Test-Path (Join-Path $docTemplateRoot "package.json")
        if ($serverInRoot -or $packageInRoot) {
            $docTemplateBackend = $docTemplateRoot
        }
    }
}

# Méthode 2 : Chercher dans continue/doc_template/back (PRIORITÉ au dossier back)
if (-not $docTemplateBackend) {
    $continueRoot = Find-FolderByName "continue" $htdocsRoot
    if ($continueRoot) {
        $docTemplateRoot = Join-Path $continueRoot "doc_template"
        if (Test-Path $docTemplateRoot) {
            # TOUJOURS chercher d'abord dans le dossier back (pas backend pour doc_template)
            $backPath = Join-Path $docTemplateRoot "back"
            if (Test-Path $backPath) {
                # Vérifier qu'il y a au moins server.js ou package.json dans back
                $hasServer = Test-Path (Join-Path $backPath "server.js")
                $hasPackage = Test-Path (Join-Path $backPath "package.json")
                if ($hasServer -or $hasPackage) {
                    $docTemplateBackend = $backPath
                }
            }
            
            # Si back n'existe pas, essayer backend (fallback)
            if (-not $docTemplateBackend) {
                $backendPath = Join-Path $docTemplateRoot "backend"
                if (Test-Path $backendPath) {
                    $hasServer = Test-Path (Join-Path $backendPath "server.js")
                    $hasPackage = Test-Path (Join-Path $backendPath "package.json")
                    if ($hasServer -or $hasPackage) {
                        $docTemplateBackend = $backendPath
                    }
                }
            }
            
            # Si ni back ni backend n'existent, chercher directement dans doc_template (fallback)
            if (-not $docTemplateBackend) {
                $serverInRoot = Test-Path (Join-Path $docTemplateRoot "server.js")
                $packageInRoot = Test-Path (Join-Path $docTemplateRoot "package.json")
                if ($serverInRoot -or $packageInRoot) {
                    $docTemplateBackend = $docTemplateRoot
                }
            }
        }
    }
}

# Méthode 3 : Chercher par package.json dans back ou backend
if (-not $docTemplateBackend) {
    $packageJson = Find-FileByName "package.json" $htdocsRoot | Where-Object { 
        $_ -like "*doc_template*back*" -or 
        $_ -like "*continue*doc_template*back*" -or
        $_ -like "*doc_template*backend*" -or 
        $_ -like "*continue*doc_template*backend*" 
    } | Select-Object -First 1
    if ($packageJson) {
        $docTemplateBackend = $packageJson
    }
}

# Méthode 4 : Fallback - chercher server.js
if (-not $docTemplateBackend) {
    $serverJs = Find-FileByName "server.js" $htdocsRoot | Where-Object { 
        $_ -like "*doc_template*" -or $_ -like "*continue*" 
    } | Select-Object -First 1
    if ($serverJs) {
        # Si server.js est dans un dossier backend, utiliser ce dossier
        if ((Split-Path $serverJs -Leaf) -eq "backend") {
            $docTemplateBackend = $serverJs
        } else {
            # Sinon, essayer d'ajouter backend
            $docTemplateBackend = Join-Path $serverJs "backend"
            if (-not (Test-Path $docTemplateBackend)) {
                $docTemplateBackend = $serverJs
            }
        }
    }
}

# Méthode 5 : Tester les chemins par défaut directement (chercher d'abord dans back, puis backend)
if (-not $docTemplateBackend) {
    $defaultPaths = @(
        "C:\xampp\htdocs\continue\doc_template\back",
        "C:\xampp\htdocs\doc_template\back",
        "C:\xampp\htdocs\continue\doc_template\backend",
        "C:\xampp\htdocs\doc_template\backend",
        "D:\xampp\htdocs\continue\doc_template\back",
        "D:\xampp\htdocs\doc_template\back",
        "D:\xampp\htdocs\continue\doc_template\backend",
        "D:\xampp\htdocs\doc_template\backend"
    )
    
    foreach ($path in $defaultPaths) {
        if (Test-Path $path) {
            # Vérifier qu'il y a au moins server.js ou package.json
            if ((Test-Path (Join-Path $path "server.js")) -or (Test-Path (Join-Path $path "package.json"))) {
                $docTemplateBackend = $path
                break
            }
        }
    }
}

# Méthode 6 : Recherche récursive dans doc_template pour trouver server.js ou package.json
if (-not $docTemplateBackend) {
    $docTemplateRoots = @(
        "C:\xampp\htdocs\continue\doc_template",
        "C:\xampp\htdocs\doc_template"
    )
    
    foreach ($root in $docTemplateRoots) {
        if (Test-Path $root) {
            # Chercher récursivement server.js ou package.json
            $foundFile = Get-ChildItem -Path $root -Filter "server.js" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
            if (-not $foundFile) {
                $foundFile = Get-ChildItem -Path $root -Filter "package.json" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
            }
            
            if ($foundFile) {
                $docTemplateBackend = $foundFile.DirectoryName
                break
            }
        }
    }
}

# Chercher lostingame par dossier
$lostingameRoot = Find-FolderByName "lostingame" $htdocsRoot
if ($lostingameRoot) {
    $lostingameBackend = Join-Path $lostingameRoot "backend"
    if (-not (Test-Path $lostingameBackend)) {
        $lostingameBackend = $lostingameRoot
    }
} else {
    # Fallback : chercher par package.json dans backend
    $lostingameBackend = Find-FileByName "package.json" $htdocsRoot | Where-Object { $_ -like "*lostingame*backend*" } | Select-Object -First 1
    if ($lostingameBackend) {
        $lostingameBackend = Split-Path $lostingameBackend -Parent
    }
}

# Afficher les chemins détectés
Write-Host ""
Write-ColoredMessage "📋 Chemins détectés:" -Type Title
if ($gdriRoot) {
    Write-ColoredMessage "  ✅ GDRI: $gdriRoot" -Type Success
} else {
    Write-ColoredMessage "  ❌ GDRI: Non trouvé" -Type Error
}

if ($backendIA) {
    Write-ColoredMessage "  ✅ BackendIA: $backendIA" -Type Success
} else {
    Write-ColoredMessage "  ⚠️  BackendIA: Non trouvé" -Type Warning
}

if ($docTemplateBackend) {
    Write-ColoredMessage "  ✅ doc_template: $docTemplateBackend" -Type Success
    # Vérifier package.json
    $packageJson = Join-Path $docTemplateBackend "package.json"
    if (Test-Path $packageJson) {
        Write-ColoredMessage "     → package.json trouvé (utilisera 'npm run dev')" -Type Info
    } else {
        Write-ColoredMessage "     → package.json non trouvé (utilisera 'node server.js')" -Type Info
    }
} else {
    Write-ColoredMessage "  ❌ doc_template: Non trouvé" -Type Error
    Write-ColoredMessage "     💡 Vérifiez que le dossier existe à:" -Type Info
    Write-ColoredMessage "        C:\\xampp\\htdocs\\continue\\doc_template\\backend" -Type Info
}

if ($lostingameBackend) {
    Write-ColoredMessage "  ✅ lostingame: $lostingameBackend" -Type Success
} else {
    Write-ColoredMessage "  ⚠️  lostingame: Non trouvé" -Type Warning
}

Write-Host ""

# Variables globales pour les processus
$global:Processes = @{}
$global:Jobs = @{}

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
    if (-not $gdriRoot) {
        Write-ColoredMessage "  ❌ GDRI Backend non trouvé" -Type Error
        return
    }
    
    $backendPath = Join-Path $gdriRoot "backend"
    if (-not (Test-Path (Join-Path $backendPath "server.js"))) {
        Write-ColoredMessage "  ❌ server.js non trouvé dans $backendPath" -Type Error
        return
    }
    
    Write-ColoredMessage "🚀 Démarrage GDRI Backend (Port 3000)..." -Type Info
    Write-ColoredMessage "  Chemin: $backendPath" -Type Info
    
    # Vérifier que node est disponible
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-ColoredMessage "  ❌ Node.js non trouvé dans le PATH" -Type Error
        return
    }
    
    if ($ShowWindows) {
        # Ouvrir une fenêtre séparée
        $scriptBlock = "Set-Location '$backendPath'; Write-Host 'GDRI Backend - Port 3000'; Write-Host 'Chemin: $backendPath'; Write-Host ''; node server.js; Write-Host ''; Write-Host 'Appuyez sur une touche pour fermer...'; `$null = `$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')"
        Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $scriptBlock -WindowStyle Normal
        Write-ColoredMessage "  ✅ GDRI Backend démarré dans une fenêtre séparée" -Type Success
    } else {
        # Job en arrière-plan
        $job = Start-Job -ScriptBlock {
            param($path)
            Set-Location $path
            node server.js
        } -ArgumentList $backendPath
        
        $global:Jobs["GDRI Backend"] = $job
        Write-ColoredMessage "  ✅ GDRI Backend démarré (Job ID: $($job.Id))" -Type Success
    }
}

# Fonction pour démarrer BackendIA
function Start-BackendIA {
    if (-not $backendIA) {
        Write-ColoredMessage "  ⚠️  BackendIA non trouvé, ignoré" -Type Warning
        return
    }
    
    if (-not (Test-Path (Join-Path $backendIA "main.py"))) {
        Write-ColoredMessage "  ❌ main.py non trouvé dans $backendIA" -Type Error
        return
    }
    
    Write-ColoredMessage "🚀 Démarrage BackendIA (Port 8000)..." -Type Info
    
    # Essayer "py" en premier (Windows), puis "python"
    $pythonCmd = $null
    if (Get-Command py -ErrorAction SilentlyContinue) {
        $pythonCmd = "py"
        Write-ColoredMessage "  Utilisation de: py" -Type Info
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        $pythonCmd = "python"
        Write-ColoredMessage "  Utilisation de: python" -Type Info
    } else {
        Write-ColoredMessage "  ❌ Python non trouvé (py ou python)" -Type Error
        return
    }
    
    if ($ShowWindows) {
        # Ouvrir une fenêtre séparée
        $scriptBlock = "Set-Location '$backendIA'; Write-Host 'BackendIA - Port 8000'; Write-Host 'Chemin: $backendIA'; Write-Host 'Commande: $pythonCmd -m uvicorn main:app --host 0.0.0.0 --port 8000'; Write-Host ''; $pythonCmd -m uvicorn main:app --host 0.0.0.0 --port 8000; Write-Host ''; Write-Host 'Appuyez sur une touche pour fermer...'; `$null = `$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')"
        Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $scriptBlock -WindowStyle Normal
        Write-ColoredMessage "  ✅ BackendIA démarré dans une fenêtre séparée" -Type Success
    } else {
        # Job en arrière-plan
        $job = Start-Job -ScriptBlock {
            param($path, $python)
            Set-Location $path
            & $python -m uvicorn main:app --host 0.0.0.0 --port 8000
        } -ArgumentList $backendIA, $pythonCmd
        
        $global:Jobs["BackendIA"] = $job
        Write-ColoredMessage "  ✅ BackendIA démarré (Job ID: $($job.Id))" -Type Success
    }
}

# Fonction pour démarrer doc_template Backend
function Start-DocTemplateBackend {
    Write-ColoredMessage "🔍 Recherche du backend doc_template..." -Type Info
    
    if (-not $docTemplateBackend) {
        Write-ColoredMessage "  ❌ doc_template Backend non trouvé" -Type Error
        Write-ColoredMessage "  💡 Vérifiez que le dossier existe à l'un de ces emplacements:" -Type Info
        Write-ColoredMessage "     - C:\xampp\htdocs\continue\doc_template\back" -Type Info
        Write-ColoredMessage "     - C:\xampp\htdocs\continue\doc_template\backend" -Type Info
        Write-ColoredMessage "     - C:\xampp\htdocs\doc_template\back" -Type Info
        Write-ColoredMessage "  ⚠️  doc_template Backend ignoré" -Type Warning
        return
    }
    
    # Chercher server.js ou package.json
    $serverFile = Join-Path $docTemplateBackend "server.js"
    $packageJson = Join-Path $docTemplateBackend "package.json"
    
    if (-not (Test-Path $serverFile) -and -not (Test-Path $packageJson)) {
        Write-ColoredMessage "  ❌ server.js ou package.json non trouvé dans $docTemplateBackend" -Type Error
        
        # Si on est dans doc_template, essayer le sous-dossier back (puis backend en fallback)
        if ($docTemplateBackend -like "*doc_template" -and $docTemplateBackend -notlike "*back*") {
            # Essayer d'abord "back"
            $possibleBack = Join-Path $docTemplateBackend "back"
            Write-ColoredMessage "  🔍 Tentative avec le sous-dossier back: $possibleBack" -Type Info
            
            if (Test-Path $possibleBack) {
                $docTemplateBackend = $possibleBack
                $serverFile = Join-Path $docTemplateBackend "server.js"
                $packageJson = Join-Path $docTemplateBackend "package.json"
                
                if (Test-Path $serverFile -or Test-Path $packageJson) {
                    Write-ColoredMessage "  ✅ Fichiers trouvés dans $docTemplateBackend" -Type Success
                } else {
                    Write-ColoredMessage "  ❌ server.js ou package.json non trouvé dans $docTemplateBackend" -Type Error
                    # Essayer backend en fallback
                    $possibleBackend = Join-Path (Split-Path $docTemplateBackend -Parent) "backend"
                    if (Test-Path $possibleBackend) {
                        Write-ColoredMessage "  🔍 Tentative avec le sous-dossier backend: $possibleBackend" -Type Info
                        $docTemplateBackend = $possibleBackend
                        $serverFile = Join-Path $docTemplateBackend "server.js"
                        $packageJson = Join-Path $docTemplateBackend "package.json"
                        if (-not (Test-Path $serverFile) -and -not (Test-Path $packageJson)) {
                            Write-ColoredMessage "  ❌ server.js ou package.json non trouvé non plus dans $docTemplateBackend" -Type Error
                            Write-ColoredMessage "  ⚠️  doc_template Backend ignoré" -Type Warning
                            return
                        }
                    } else {
                        Write-ColoredMessage "  ⚠️  doc_template Backend ignoré" -Type Warning
                        return
                    }
                }
            } else {
                # Essayer backend si back n'existe pas
                $possibleBackend = Join-Path $docTemplateBackend "backend"
                if (Test-Path $possibleBackend) {
                    Write-ColoredMessage "  🔍 Tentative avec le sous-dossier backend: $possibleBackend" -Type Info
                    $docTemplateBackend = $possibleBackend
                    $serverFile = Join-Path $docTemplateBackend "server.js"
                    $packageJson = Join-Path $docTemplateBackend "package.json"
                    if (-not (Test-Path $serverFile) -and -not (Test-Path $packageJson)) {
                        Write-ColoredMessage "  ❌ server.js ou package.json non trouvé dans $docTemplateBackend" -Type Error
                        Write-ColoredMessage "  ⚠️  doc_template Backend ignoré" -Type Warning
                        return
                    }
                } else {
                    Write-ColoredMessage "  ❌ Les dossiers back et backend n'existent pas" -Type Error
                    Write-ColoredMessage "  ⚠️  doc_template Backend ignoré" -Type Warning
                    return
                }
            }
        } else {
            Write-ColoredMessage "  ⚠️  doc_template Backend ignoré" -Type Warning
            return
        }
    }
    
    Write-ColoredMessage "🚀 Démarrage doc_template Backend (Port 5005)..." -Type Info
    Write-ColoredMessage "  Chemin: $docTemplateBackend" -Type Info
    
    $useNpm = Test-Path $packageJson
    if ($useNpm) {
        Write-ColoredMessage "  ✅ package.json trouvé → Utilisation de: npm run dev" -Type Success
    } else {
        Write-ColoredMessage "  ⚠️  package.json non trouvé → Utilisation de: node server.js" -Type Warning
        Write-ColoredMessage "  💡 Pour utiliser 'npm run dev', assurez-vous que package.json existe dans $docTemplateBackend" -Type Info
    }
    
    if ($ShowWindows) {
        # Ouvrir une fenêtre séparée
        if ($useNpm) {
            $scriptBlock = "Set-Location '$docTemplateBackend'; Write-Host 'doc_template Backend - Port 5005'; Write-Host 'Chemin: $docTemplateBackend'; Write-Host ''; npm run dev; Write-Host ''; Write-Host 'Appuyez sur une touche pour fermer...'; `$null = `$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')"
        } else {
            $scriptBlock = "Set-Location '$docTemplateBackend'; Write-Host 'doc_template Backend - Port 5005'; Write-Host 'Chemin: $docTemplateBackend'; Write-Host ''; node server.js; Write-Host ''; Write-Host 'Appuyez sur une touche pour fermer...'; `$null = `$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')"
        }
        Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $scriptBlock -WindowStyle Normal
        Write-ColoredMessage "  ✅ doc_template Backend démarré dans une fenêtre séparée" -Type Success
    } else {
        # Job en arrière-plan
        $job = Start-Job -ScriptBlock {
            param($path, $useNpm)
            Set-Location $path
            if ($useNpm) {
                npm run dev
            } else {
                node server.js
            }
        } -ArgumentList $docTemplateBackend, $useNpm
        
        $global:Jobs["doc_template Backend"] = $job
        Write-ColoredMessage "  ✅ doc_template Backend démarré (Job ID: $($job.Id))" -Type Success
    }
}

# Fonction pour démarrer lostingame Backend
function Start-LostingameBackend {
    if (-not $lostingameBackend) {
        Write-ColoredMessage "  ⚠️  lostingame Backend non trouvé, ignoré" -Type Warning
        return
    }
    
    # Chercher le dossier backend dans lostingame
    $backendPath = Join-Path $lostingameBackend "backend"
    if (-not (Test-Path $backendPath)) {
        $backendPath = $lostingameBackend
    }
    
    $packageJson = Join-Path $backendPath "package.json"
    if (-not (Test-Path $packageJson)) {
        Write-ColoredMessage "  ❌ package.json non trouvé dans $backendPath" -Type Error
        return
    }
    
    Write-ColoredMessage "🚀 Démarrage lostingame Backend (Port 5001)..." -Type Info
    Write-ColoredMessage "  Chemin: $backendPath" -Type Info
    
    if ($ShowWindows) {
        # Ouvrir une fenêtre séparée
        $scriptBlock = "Set-Location '$backendPath'; Write-Host 'lostingame Backend - Port 5001'; Write-Host 'Chemin: $backendPath'; Write-Host ''; npm run dev; Write-Host ''; Write-Host 'Appuyez sur une touche pour fermer...'; `$null = `$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')"
        Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $scriptBlock -WindowStyle Normal
        Write-ColoredMessage "  ✅ lostingame Backend démarré dans une fenêtre séparée" -Type Success
    } else {
        # Job en arrière-plan
        $job = Start-Job -ScriptBlock {
            param($path)
            Set-Location $path
            npm run dev
        } -ArgumentList $backendPath
        
        $global:Jobs["lostingame Backend"] = $job
        Write-ColoredMessage "  ✅ lostingame Backend démarré (Job ID: $($job.Id))" -Type Success
    }
}

# Fonction pour démarrer Security Monitor
function Start-SecurityMonitor {
    if (-not $gdriRoot) {
        Write-ColoredMessage "  ❌ GDRI non trouvé, Security Monitor ignoré" -Type Error
        return
    }
    
    $monitorFile = Join-Path $gdriRoot "backend\security-monitor.js"
    if (-not (Test-Path $monitorFile)) {
        Write-ColoredMessage "  ⚠️  security-monitor.js non trouvé, ignoré" -Type Warning
        return
    }
    
    Write-ColoredMessage "🚀 Démarrage Security Monitor..." -Type Info
    Write-ColoredMessage "  Chemin: $gdriRoot" -Type Info
    
    if ($ShowWindows) {
        # Ouvrir une fenêtre séparée
        $scriptBlock = "Set-Location '$gdriRoot'; Write-Host 'Security Monitor'; Write-Host 'Chemin: $gdriRoot'; Write-Host ''; node backend\security-monitor.js; Write-Host ''; Write-Host 'Appuyez sur une touche pour fermer...'; `$null = `$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')"
        Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $scriptBlock -WindowStyle Normal
        Write-ColoredMessage "  ✅ Security Monitor démarré dans une fenêtre séparée" -Type Success
    } else {
        # Job en arrière-plan
        $job = Start-Job -ScriptBlock {
            param($path)
            Set-Location $path
            node backend\security-monitor.js
        } -ArgumentList $gdriRoot
        
        $global:Jobs["Security Monitor"] = $job
        Write-ColoredMessage "  ✅ Security Monitor démarré (Job ID: $($job.Id))" -Type Success
    }
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

# Gestion de l'arrêt propre
$null = Register-EngineEvent PowerShell.Exiting -Action {
    Stop-AllBackends
}

# Script principal
try {
    Write-Host ""
    Write-ColoredMessage "🌟 DÉMARRAGE AUTOMATIQUE DE TOUS LES BACKENDS GDRI" -Type Title
    Write-ColoredMessage "===================================================" -Type Title
    Write-Host ""
    
    # Vérifier les prérequis
    Write-ColoredMessage "🔍 Vérification des prérequis..." -Type Info
    
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-ColoredMessage "❌ Node.js n'est pas installé ou n'est pas dans le PATH" -Type Error
        exit 1
    }
    Write-ColoredMessage "  ✅ Node.js trouvé" -Type Success
    
    # Vérifier Python (py en priorité pour Windows)
    $pythonFound = $false
    if (Get-Command py -ErrorAction SilentlyContinue) {
        Write-ColoredMessage "  ✅ Python (py) trouvé" -Type Success
        $pythonFound = $true
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        Write-ColoredMessage "  ✅ Python trouvé" -Type Success
        $pythonFound = $true
    } else {
        Write-ColoredMessage "  ⚠️  Python non trouvé (BackendIA ne pourra pas démarrer)" -Type Warning
    }
    
    Write-Host ""
    
    # Démarrer tous les backends
    Start-GDRIBackend
    Start-Sleep -Seconds 1
    
    if ($pythonFound) {
        Start-BackendIA
        Start-Sleep -Seconds 1
    }
    
    Start-DocTemplateBackend
    Start-Sleep -Seconds 1
    
    Start-LostingameBackend
    Start-Sleep -Seconds 1
    
    Start-SecurityMonitor
    
    Write-Host ""
    Write-ColoredMessage "===================================================" -Type Title
    Write-ColoredMessage "✅ Tous les backends sont en cours de démarrage" -Type Success
    Write-ColoredMessage "===================================================" -Type Title
    Write-Host ""
    
    # Attendre un peu pour que tout démarre
    Start-Sleep -Seconds 3
    
    # Afficher le statut
    Show-Status
    
    Write-ColoredMessage "Commandes utiles:" -Type Info
    Write-Host "  - Recevoir-Job -Job `$global:Jobs['GDRI Backend'] : Voir les logs"
    Write-Host "  - Stop-Job -Job `$global:Jobs['GDRI Backend'] : Arreter un backend"
    Write-Host "  - Appuyez sur Ctrl+C pour arreter tous les backends"
    Write-Host ""
    
    Write-ColoredMessage "Surveillance en cours... (Ctrl+C pour arreter)" -Type Warning
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


