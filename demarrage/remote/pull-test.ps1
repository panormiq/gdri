#Requires -Version 5.1
<#
.SYNOPSIS
  Depuis un PC distant (Tailscale) : pull branche develop sur le serveur.
#>
param([switch]$NoRestart)

$ErrorActionPreference = 'Stop'
$configPath = Join-Path $PSScriptRoot 'config.ps1'
$examplePath = Join-Path $PSScriptRoot 'config.example.ps1'

if (-not (Test-Path $configPath)) {
    Write-Host "Cree d abord config.ps1 :" -ForegroundColor Yellow
    Write-Host "  copy config.example.ps1 config.ps1" -ForegroundColor Cyan
    Write-Host "Puis renseigne ServerHost (IP Tailscale) et ServerUser." -ForegroundColor Yellow
    if (Test-Path $examplePath) { Copy-Item $examplePath $configPath -ErrorAction SilentlyContinue }
    exit 1
}

$config = & $configPath
$hostName = $config.ServerHost
$user = $config.ServerUser
$script = $config.UpdateScript
$restart = if ($NoRestart) { $false } else { [bool]$config.RestartBackend }

if (-not $hostName -or $hostName -match '100\.x\.|CHANGE_ME') {
    throw "Edite demarrage\remote\config.ps1 : ServerHost = IP VPN du serveur (ex. 192.168.30.1)"
}

$args = "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -Target Test"
if ($restart) { $args += ' -RestartBackend' }

Write-Host "SSH $user@$hostName → Update TEST..." -ForegroundColor Cyan
ssh "${user}@${hostName}" "powershell $args"
exit $LASTEXITCODE
