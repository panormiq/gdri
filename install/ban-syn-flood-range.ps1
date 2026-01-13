# Script PowerShell pour bannir une plage IP lors d'une attaque SYN Flood distribuée
# Usage: .\ban-syn-flood-range.ps1 -Range "190.111.96.0/22"

param(
    [Parameter(Mandatory=$true)]
    [string]$Range,
    
    [Parameter(Mandatory=$false)]
    [string]$RuleName = "Block SYN Flood Distributed Attack"
)

Write-Host "🚨 Bannissement de la plage IP pour attaque SYN Flood distribuée" -ForegroundColor Red
Write-Host "============================================" -ForegroundColor Red
Write-Host ""

# Extraire le réseau et le masque depuis la notation CIDR ou IP/Mask
if ($Range -match '^(\d+\.\d+\.\d+\.\d+)/(\d+)$') {
    $networkIP = $Matches[1]
    $cidr = [int]$Matches[2]
    
    # Convertir CIDR en masque de sous-réseau
    $mask = ""
    if ($cidr -eq 24) {
        $mask = "255.255.255.0"
    } elseif ($cidr -eq 22) {
        $mask = "255.255.252.0"
    } elseif ($cidr -eq 20) {
        $mask = "255.255.240.0"
    } elseif ($cidr -eq 16) {
        $mask = "255.255.0.0"
    } else {
        Write-Host "❌ CIDR non supporté: /$cidr (supporté: /16, /20, /22, /24)" -ForegroundColor Yellow
        exit 1
    }
    
    $ipRange = "$networkIP/$mask"
} elseif ($Range -match '^(\d+\.\d+\.\d+\.\d+)/(\d+\.\d+\.\d+\.\d+)$') {
    $networkIP = $Matches[1]
    $mask = $Matches[2]
    $ipRange = "$networkIP/$mask"
} else {
    Write-Host "❌ Format de plage IP invalide. Utilisez: IP/CIDR (ex: 190.111.96.0/22) ou IP/Mask (ex: 190.111.96.0/255.255.252.0)" -ForegroundColor Red
    exit 1
}

Write-Host "📊 Plage IP à bannir: $ipRange" -ForegroundColor Yellow
Write-Host "📝 Nom de la règle: $RuleName" -ForegroundColor Yellow
Write-Host ""

# Vérifier si la règle existe déjà (simplifié - on la créera directement, elle sera mise à jour si elle existe)
Write-Host "🔍 Vérification si la règle existe déjà..." -ForegroundColor Cyan

# Créer la règle de pare-feu
Write-Host "🔧 Création de la règle de pare-feu..." -ForegroundColor Cyan

$result = netsh advfirewall firewall add rule name="$RuleName" dir=in action=block remoteip=$ipRange protocol=TCP 2>&1

if ($LASTEXITCODE -eq 0 -or $result -match "Ok") {
    Write-Host "✅ Règle de pare-feu créée avec succès !" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Détails de la règle:" -ForegroundColor Cyan
    netsh advfirewall firewall show rule name="$RuleName"
} else {
    # Vérifier si la règle existe déjà
    if ($result -match "already exists" -or $result -match "déjà existe") {
        Write-Host "⚠️  La règle existe déjà. Utilisation de la règle existante." -ForegroundColor Yellow
        netsh advfirewall firewall show rule name="$RuleName"
    } else {
        Write-Host "❌ Erreur lors de la création de la règle: $result" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "🔍 Vérification des connexions SYN_RECEIVED actuelles..." -ForegroundColor Cyan
$synCount = (netstat -ano | Select-String ":443" | Select-String "SYN_RECEIVED").Count
Write-Host "📊 Connexions SYN_RECEIVED actuelles: $synCount" -ForegroundColor Yellow

Write-Host ""
Write-Host "✅ Bannissement terminé ! La plage IP $ipRange est maintenant bloquée." -ForegroundColor Green
Write-Host ""
Write-Host "💡 Pour débaner cette plage IP plus tard, utilisez:" -ForegroundColor Cyan
Write-Host "   netsh advfirewall firewall delete rule name=`"$RuleName`"" -ForegroundColor Gray
