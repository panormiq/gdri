#Requires -Version 5.1

<#
.SYNOPSIS
  Met a jour le code GDRI depuis Git (TEST = gdri-dev / develop, PROD = gdri / master).

.DESCRIPTION
  Deux dossiers separes :
    - Test  → C:\xampp\htdocs\gdri-dev  (branche develop, backend :3001)
    - Prod  → C:\xampp\htdocs\gdri      (branche master, backend :3000)

  La console web ne lance que -Target Test.
  La prod reste manuelle (-Target Prod ou git pull dans gdri).

.PARAMETER Target
  Test ou Prod

.PARAMETER Branch
  Surcharge le nom de branche (defaut: develop pour Test, master pour Prod)

.PARAMETER Force
  Continue meme s'il y a des modifications locales non committees (stash puis pull)

.PARAMETER RestartBackend
  Relance le backend correspondant apres le pull

.EXAMPLE
  .\Update-From-Git.ps1 -Target Test -RestartBackend
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
$ScriptDir = $PSScriptRoot
$ThisCheckout = Split-Path -Parent $ScriptDir
$Htdocs = Split-Path -Parent $ThisCheckout
$DevRoot = Join-Path $Htdocs 'gdri-dev'
$ProdRoot = Join-Path $Htdocs 'gdri'

if ($Target -eq 'Test') {
    if (Test-Path (Join-Path $DevRoot '.git')) {
        $ProjectRoot = $DevRoot
    } else {
        $ProjectRoot = $ThisCheckout
    }
    if (-not $Branch) { $Branch = 'develop' }
    $port = 3001
    $backendBat = Join-Path $ProjectRoot 'demarrage\02-backend-test.bat'
} else {
    if (Test-Path (Join-Path $ProdRoot '.git')) {
        $ProjectRoot = $ProdRoot
    } else {
        $ProjectRoot = $ThisCheckout
    }
    if (-not $Branch) { $Branch = 'master' }
    $port = 3000
    $backendBat = Join-Path $ProjectRoot 'demarrage\01-backend-prod.bat'
}

Set-Location $ProjectRoot

function Write-Msg {
    param(
        [string]$Message,
        [string]$Color = 'Cyan'
    )
    Write-Host $Message -ForegroundColor $Color
}

Write-Host ''
Write-Msg ("=== Update Git GDRI - {0} ===" -f $Target) 'Magenta'
Write-Msg ("Dossier  : {0}" -f $ProjectRoot)
Write-Msg ("Branche  : {0}" -f $Branch)
Write-Msg ("Backend  : port {0}" -f $port)
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
        throw 'Annule: fichiers locaux non commités. Committez, OU passez -Force (stash auto).'
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
    throw ("Branche distante introuvable: {0}" -f $remoteBranch)
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
Write-Msg ("OK - code a jour sur {0} ({1})" -f $Branch, $ProjectRoot) 'Green'
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
        Start-Process -FilePath $backendBat -WorkingDirectory (Split-Path $backendBat)
    } else {
        Write-Msg ("Script backend introuvable: {0}" -f $backendBat) 'Yellow'
        if ($Target -eq 'Test') {
            $ps1 = Join-Path $ProjectRoot 'backend\Start-Backend.ps1'
            if (Test-Path $ps1) {
                Write-Msg 'Relance via Start-Backend.ps1 -Mode Test' 'Green'
                Start-Process powershell.exe -ArgumentList @(
                    '-NoProfile', '-ExecutionPolicy', 'Bypass',
                    '-File', $ps1, '-Mode', 'Test'
                ) -WorkingDirectory (Join-Path $ProjectRoot 'backend')
            }
        }
    }
} else {
    Write-Msg ("Pense a relancer le backend {0} si besoin." -f $Target) 'Cyan'
}

Write-Host ''
