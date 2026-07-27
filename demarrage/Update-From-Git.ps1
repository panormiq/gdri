#Requires -Version 5.1

<#
.SYNOPSIS
  Met a jour le code GDRI depuis Git (branche test ou prod).

.DESCRIPTION
  ATTENTION : test.gdri.fr et www partagent le MEME dossier code (htdocs/gdri).
  Changer de branche change le code servi par LES DEUX URLs.
  Seules les bases Mongo restent separees (GDR-INNOVATION vs GDR-INNOVATION-TEST).

  -Target Test  = branche develop (defaut), git pull
  -Target Prod  = branche master, git pull (apres merge)

.PARAMETER Target
  Test ou Prod

.PARAMETER Branch
  Surcharge le nom de branche (defaut: develop pour Test, master pour Prod)

.PARAMETER Force
  Continue meme s'il y a des modifications locales non committees (stash puis pull)

.PARAMETER RestartBackend
  Relance le backend correspondant dans une nouvelle fenetre apres le pull

.EXAMPLE
  .\Update-From-Git.ps1 -Target Test

.EXAMPLE
  .\Update-From-Git.ps1 -Target Prod -RestartBackend
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Test', 'Prod')]
    [string]$Target,

    [string]$Branch = '',

    [switch]$Force,
    [switch]$RestartBackend
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Write-Msg {
    param(
        [string]$Message,
        [string]$Color = 'Cyan'
    )
    Write-Host $Message -ForegroundColor $Color
}

if (-not $Branch) {
    if ($Target -eq 'Test') {
        $Branch = 'develop'
    } else {
        $Branch = 'master'
    }
}

if ($Target -eq 'Test') {
    $port = 3001
    $backendBat = Join-Path $PSScriptRoot '02-backend-test.bat'
} else {
    $port = 3000
    $backendBat = Join-Path $PSScriptRoot '01-backend-prod.bat'
}

Write-Host ''
Write-Msg ("=== Update Git GDRI - {0} ===" -f $Target) 'Magenta'
Write-Msg ("Dossier  : {0}" -f $ProjectRoot)
Write-Msg ("Branche  : {0}" -f $Branch)
Write-Msg ("Backend  : port {0}" -f $port)
Write-Host ''
Write-Msg 'Rappel: un seul dossier code pour test + prod.' 'Yellow'
Write-Msg ("Apres ce pull, www ET test.gdri.fr servent la branche {0}." -f $Branch) 'Yellow'
Write-Host ''

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    throw 'git introuvable dans le PATH'
}

$status = git status --porcelain
if ($status) {
    Write-Msg 'Modifications locales detectees:' 'Yellow'
    git status -sb
    Write-Host ''
    if (-not $Force) {
        throw 'Annule: fichiers locaux non commités. Commit sur develop, OU coche Force dans la console (stash auto). Attention: Force stash aussi demarrage/ et pages non commités.'
    }
    Write-Msg 'Force: git stash push -u ...' 'Yellow'
    $stashMsg = "auto-stash Update-From-Git $Target $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    git stash push -u -m $stashMsg
}

Write-Msg 'git fetch origin...' 'Cyan'
git fetch origin

$remoteBranch = "origin/$Branch"
$remoteExists = git rev-parse --verify $remoteBranch 2>$null
if (-not $remoteExists) {
    throw ("Branche distante introuvable: {0} (cree-la sur GitHub ou passe -Branch xxx)" -f $remoteBranch)
}

$current = (git rev-parse --abbrev-ref HEAD).Trim()
if ($current -ne $Branch) {
    Write-Msg ("Checkout {0} (etait: {1})..." -f $Branch, $current) 'Cyan'
    git checkout $Branch
}

Write-Msg ("git pull --ff-only origin {0}..." -f $Branch) 'Cyan'
git pull --ff-only origin $Branch
if ($LASTEXITCODE -ne 0) {
    throw 'git pull a echoue (fast-forward impossible ?). Resolvez puis reessayez.'
}

Write-Host ''
Write-Msg ("OK - code a jour sur {0}" -f $Branch) 'Green'
git log -1 --oneline
Write-Host ''

if ($RestartBackend) {
    Write-Msg ("Arret eventuel du process sur le port {0}..." -f $port) 'Cyan'
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
        $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $pids) {
            try {
                $p = Get-Process -Id $procId -ErrorAction Stop
                Write-Msg ("  Stop PID {0} ({1})" -f $procId, $p.ProcessName) 'Yellow'
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            } catch {
                # ignore
            }
        }
        Start-Sleep -Seconds 2
    } else {
        Write-Msg ("Aucun process sur le port {0} - demarrage a froid." -f $port) 'Cyan'
    }

    if (Test-Path $backendBat) {
        Write-Msg ("Relance: {0}" -f $backendBat) 'Green'
        Start-Process -FilePath $backendBat -WorkingDirectory $PSScriptRoot
    } else {
        Write-Msg ("Script backend introuvable: {0} - relance manuellement." -f $backendBat) 'Yellow'
    }
} else {
    Write-Msg ("Pense a relancer le backend {0} si besoin:" -f $Target) 'Cyan'
    if ($Target -eq 'Test') {
        Write-Msg '  demarrage\02-backend-test.bat'
    } else {
        Write-Msg '  demarrage\01-backend-prod.bat'
    }
}

Write-Host ''
