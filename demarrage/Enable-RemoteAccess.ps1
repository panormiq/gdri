#Requires -Version 5.1
#Requires -RunAsAdministrator

<#
.SYNOPSIS
  Prepare le serveur pour acces distant derriere un VPN local (SoftEther / WireGuard).

.DESCRIPTION
  - Installe/active OpenSSH Server
  - Demarre sshd
  - Ouvre le firewall Windows pour SSH sur profil Prive (LAN / VPN)
  - N'ouvre PAS SSH sur Internet public

  A faire APRES avoir configure ton VPN local (SoftEther recommande).
  Voir demarrage\REMOTE-ACCESS.md
#>

$ErrorActionPreference = 'Stop'

function Write-Msg([string]$Message, [string]$Color = 'Cyan') {
    Write-Host $Message -ForegroundColor $Color
}

Write-Host ''
Write-Msg '=== GDRI — Enable Remote Access (SSH, VPN local) ===' 'Magenta'
Write-Host ''
Write-Msg 'Ce script n installe PAS le VPN.' 'Yellow'
Write-Msg 'VPN local: SoftEther Server ou WireGuard — voir REMOTE-ACCESS.md' 'Yellow'
Write-Host ''

Write-Msg 'Verification OpenSSH Server...' 'Cyan'
$cap = Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH.Server*'
if (-not $cap) {
    Write-Msg 'Impossible de lister les capacites Windows (edition / rights ?).' 'Yellow'
} elseif ($cap.State -ne 'Installed') {
    Write-Msg 'Installation OpenSSH.Server...' 'Cyan'
    Add-WindowsCapability -Online -Name 'OpenSSH.Server~~~~0.0.1.0' | Out-Null
    Write-Msg 'OpenSSH.Server installe.' 'Green'
} else {
    Write-Msg 'OpenSSH.Server deja installe.' 'Green'
}

$sshd = Get-Service -Name sshd -ErrorAction SilentlyContinue
if ($sshd) {
    if ($sshd.Status -ne 'Running') {
        Start-Service sshd
        Write-Msg 'Service sshd demarre.' 'Green'
    } else {
        Write-Msg 'Service sshd deja actif.' 'Green'
    }
    Set-Service -Name sshd -StartupType Automatic
} else {
    Write-Msg 'Service sshd introuvable — reboot peut etre necessaire.' 'Yellow'
}

Write-Msg 'Regle firewall SSH (profil Prive)...' 'Cyan'
$ruleName = 'GDRI OpenSSH (Private)'
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $existing) {
    New-NetFirewallRule -DisplayName $ruleName `
        -Direction Inbound -Protocol TCP -LocalPort 22 `
        -Action Allow -Profile Private |
        Out-Null
    Write-Msg 'Regle creee.' 'Green'
} else {
    Write-Msg 'Regle deja presente.' 'Green'
    Enable-NetFirewallRule -DisplayName $ruleName | Out-Null
}

$user = $env:USERNAME
$computer = $env:COMPUTERNAME
Write-Host ''
Write-Msg '=== Pret ===' 'Green'
Write-Msg "Utilisateur Windows : $user"
Write-Msg "Machine             : $computer"
Write-Host ''
Write-Msg '1) Configure SoftEther (ou WireGuard) — REMOTE-ACCESS.md' 'Cyan'
Write-Msg '2) Collab se connecte au VPN' 'Cyan'
Write-Msg '3) ssh USER@<IP-VPN>  puis scripts update' 'Cyan'
Write-Msg '   ou remote\config.ps1 + remote\pull-test.ps1' 'Cyan'
Write-Host ''
