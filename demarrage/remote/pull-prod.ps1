#Requires -Version 5.1
<#
.SYNOPSIS
  Depuis un PC distant (Tailscale) : pull branche master sur le serveur (apres merge).
#>
param([switch]$NoRestart)

$ErrorActionPreference = 'Stop'
$configPath = Join-Path $PSScriptRoot 'config.ps1'

if (-not (Test-Path $configPath)) {
    Write-Host "Cree d abord config.ps1 depuis config.example.ps1" -ForegroundColor Yellow
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

$args = "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -Target Prod"
if ($restart) { $args += ' -RestartBackend' }

Write-Host "SSH $user@$hostName → Update PROD..." -ForegroundColor Cyan
Write-Host "Confirme que le merge develop→master est fait sur GitHub." -ForegroundColor Yellow
ssh "${user}@${hostName}" "powershell $args"
exit $LASTEXITCODE
