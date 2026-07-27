#Requires -Version 5.1

<#
.SYNOPSIS
    Demarre le backend GDRI Node.js (prod ou test).

.DESCRIPTION
    Mode Prod  : .env        -> port 3000 -> GDR-INNOVATION
    Mode Test  : .env.test   -> port 3001 -> GDR-INNOVATION-TEST

.PARAMETER Mode
    Prod (defaut) ou Test

.PARAMETER Dev
    Utilise nodemon si disponible (rechargement auto)

.PARAMETER SkipChecks
    Ignore les verifications preliminaires

.PARAMETER SkipCloneHint
    En mode Test, n'affiche pas le rappel de clonage Mongo

.EXAMPLE
    .\Start-Backend.ps1
    Demarre le backend production (port 3000)

.EXAMPLE
    .\Start-Backend.ps1 -Mode Test
    Demarre le backend test (port 3001, base TEST)

.EXAMPLE
    .\Start-Backend.ps1 -Mode Test -Dev
    Backend test avec nodemon
#>

[CmdletBinding()]
param(
    [ValidateSet('Prod', 'Test')]
    [string]$Mode = 'Prod',

    [switch]$Dev,
    [switch]$SkipChecks,
    [switch]$SkipCloneHint
)

$ErrorActionPreference = 'Stop'
$BackendRoot = $PSScriptRoot
Set-Location $BackendRoot

$Colors = @{
    Info    = 'Cyan'
    Success = 'Green'
    Warning = 'Yellow'
    Error   = 'Red'
    Title   = 'Magenta'
}

function Write-Msg {
    param([string]$Message, [string]$Type = 'Info')
    Write-Host $Message -ForegroundColor $Colors[$Type]
}

function Test-NodeInstallation {
    Write-Msg 'Verification de Node.js...' -Type Info
    try {
        $version = & node --version 2>&1
        if ($LASTEXITCODE -ne 0) { throw 'node --version a echoue' }
        Write-Msg "Node.js trouve: $version" -Type Success
        return $true
    } catch {
        Write-Msg 'Node.js introuvable dans le PATH' -Type Error
        throw 'Installez Node.js ou ouvrez un terminal ou node est accessible.'
    }
}

function Ensure-EnvTestFile {
    $envTest = Join-Path $BackendRoot '.env.test'
    $envExample = Join-Path $BackendRoot '.env.test.example'
    $envProd = Join-Path $BackendRoot '.env'

    if (Test-Path $envTest) { return $envTest }

    if (-not (Test-Path $envExample)) {
        throw "Fichier manquant: $envExample"
    }

    Write-Msg 'Creation de .env.test depuis .env.test.example...' -Type Warning
    Copy-Item $envExample $envTest

    if (Test-Path $envProd) {
        Write-Msg 'Fusion des secrets depuis .env (cles absentes uniquement)...' -Type Info
        $existing = @{}
        Get-Content $envTest | ForEach-Object {
            if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
            $name = ($_ -split '=', 2)[0].Trim()
            if ($name) { $existing[$name] = $true }
        }
        $extra = @()
        Get-Content $envProd | ForEach-Object {
            $line = $_.TrimEnd()
            if ($line -match '^\s*#' -or $line -notmatch '=') { return }
            $name = ($line -split '=', 2)[0].Trim()
            if ($name -and -not $existing.ContainsKey($name)) {
                $extra += $line
                $existing[$name] = $true
            }
        }
        if ($extra.Count -gt 0) {
            Add-Content -Path $envTest -Value ''
            Add-Content -Path $envTest -Value '# Secrets repris de .env'
            Add-Content -Path $envTest -Value $extra
        }
    }

    Write-Msg '.env.test cree. Verifie-le si besoin.' -Type Success
    return $envTest
}

function Get-EnvValue {
    param([string]$Path, [string]$Key, [string]$Default = '')
    if (-not (Test-Path $Path)) { return $Default }
    $line = Get-Content $Path | Where-Object {
        $_ -match ('^\s*' + [regex]::Escape($Key) + '\s*=')
    } | Select-Object -First 1
    if (-not $line) { return $Default }
    $value = ($line -split '=', 2)[1].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
    return $value
}

function Test-PortAvailable {
    param([int]$Port)
    $inUse = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($inUse) {
        $pids = ($inUse | Select-Object -ExpandProperty OwningProcess -Unique) -join ', '
        Write-Msg "Port $Port deja utilise (PID: $pids)" -Type Error
        throw "Liberer le port $Port ou arreter le processus existant."
    }
    Write-Msg "Port $Port libre" -Type Success
}

function Test-ServerFile {
    $server = Join-Path $BackendRoot 'server.js'
    if (-not (Test-Path $server)) {
        throw "server.js introuvable dans $BackendRoot"
    }
    Write-Msg 'server.js OK' -Type Success
}

# --- Config selon le mode ---
if ($Mode -eq 'Test') {
    $envFile = Ensure-EnvTestFile
    $env:GDRI_ENV_FILE = '.env.test'
    $defaultPort = 3001
    $defaultDb = 'GDR-INNOVATION-TEST'
    $title = 'GDRI Backend TEST'
} else {
    $envFile = Join-Path $BackendRoot '.env'
    $env:GDRI_ENV_FILE = '.env'
    $defaultPort = 3000
    $defaultDb = 'GDR-INNOVATION'
    $title = 'GDRI Backend PROD'
    if (-not (Test-Path $envFile)) {
        Write-Msg "Attention: .env introuvable ($envFile)" -Type Warning
    }
}

$port = [int](Get-EnvValue -Path $envFile -Key 'PORT' -Default "$defaultPort")
$mongoDb = Get-EnvValue -Path $envFile -Key 'MONGODB_DB' -Default $defaultDb
$environment = Get-EnvValue -Path $envFile -Key 'ENVIRONMENT' -Default $(if ($Mode -eq 'Test') { 'test' } else { 'prod' })

Write-Host ''
Write-Msg "=== $title ===" -Type Title
Write-Msg "Dossier     : $BackendRoot"
Write-Msg "Env file    : $($env:GDRI_ENV_FILE)"
Write-Msg "Port        : $port"
Write-Msg "Mongo DB    : $mongoDb"
Write-Msg "ENVIRONMENT : $environment"
if ($Mode -eq 'Test') {
    Write-Msg 'URL         : https://test.gdri.fr' -Type Info
} else {
    Write-Msg 'URL         : https://www.gdr-innovation.fr' -Type Info
}
Write-Host ''

if (-not $SkipChecks) {
    Test-NodeInstallation
    Test-ServerFile
    Test-PortAvailable -Port $port
}

if ($Mode -eq 'Test' -and -not $SkipCloneHint) {
    Write-Host ''
    Write-Msg 'Rappel clone base prod -> test :' -Type Info
    Write-Msg '  node scripts/clone-mongo-to-test.js'
    Write-Host ''
}

# Choix du lanceur
$useNodemon = $false
if ($Dev) {
    $nodemonCmd = Get-Command nodemon -ErrorAction SilentlyContinue
    if ($nodemonCmd) {
        $useNodemon = $true
    } else {
        Write-Msg 'nodemon introuvable - demarrage avec node' -Type Warning
    }
}

Write-Msg 'Demarrage...' -Type Success
if ($useNodemon) {
    Write-Msg 'Mode Dev (nodemon)' -Type Info
    & nodemon server.js
} else {
    & node server.js
}
