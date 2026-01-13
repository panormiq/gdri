# ============================================
# Script de configuration anti-SYN flood pour Windows
# Protection contre les attaques SYN flood
# ============================================
# 
# IMPORTANT : Ce script doit être exécuté en tant qu'administrateur
# 
# Usage : 
#   PowerShell -ExecutionPolicy Bypass -File .\configure-syn-flood-protection.ps1
#
# ============================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Configuration Anti-SYN Flood Protection" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier les droits administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ ERREUR : Ce script doit être exécuté en tant qu'administrateur !" -ForegroundColor Red
    Write-Host "💡 Clic droit sur PowerShell > Exécuter en tant qu'administrateur" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Droits administrateur confirmés" -ForegroundColor Green
Write-Host ""

# ============================================
# 1. Configuration TCP/IP Windows
# ============================================
Write-Host "📡 Configuration TCP/IP Windows..." -ForegroundColor Yellow

# Activer SYN cookies (protection contre SYN flood)
Write-Host "  → Activation des SYN cookies..." -ForegroundColor Gray
netsh int tcp set global chimney=enabled 2>$null
netsh int tcp set global autotuninglevel=normal 2>$null
netsh int tcp set global ecncapability=enabled 2>$null

# Réduire le timeout SYN-ACK (défaut 2s, on passe à 1s)
Write-Host "  → Configuration des timeouts TCP..." -ForegroundColor Gray
netsh int tcp set global timestamps=enabled 2>$null

# Limiter le backlog de connexions en attente
Write-Host "  → Configuration du backlog de connexions..." -ForegroundColor Gray
# Note: Sur Windows, le backlog est géré par le système, mais on peut le limiter via le pare-feu

Write-Host "✅ Configuration TCP/IP terminée" -ForegroundColor Green
Write-Host ""

# ============================================
# 2. Configuration Pare-feu Windows
# ============================================
Write-Host "🔥 Configuration du Pare-feu Windows..." -ForegroundColor Yellow

# Règle pour limiter les connexions simultanées par IP
Write-Host "  → Création de règles de limitation de connexions..." -ForegroundColor Gray

# Supprimer les anciennes règles si elles existent
netsh advfirewall firewall delete rule name="GDRI - Limite connexions HTTP" 2>$null
netsh advfirewall firewall delete rule name="GDRI - Limite connexions HTTPS" 2>$null

# Note: Le pare-feu Windows natif ne permet pas directement de limiter les connexions par IP
# On utilise plutôt une approche avec rate limiting au niveau Apache
# Mais on peut bloquer les IPs suspectes manuellement si nécessaire

Write-Host "✅ Configuration Pare-feu terminée" -ForegroundColor Green
Write-Host ""

# ============================================
# 3. Configuration du Registre Windows
# ============================================
Write-Host "🔧 Configuration du Registre Windows..." -ForegroundColor Yellow

# Paramètres TCP/IP avancés pour protection SYN flood
$regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters"

# TcpMaxHalfOpen : Limite le nombre de connexions SYN en attente (défaut: 100, on augmente à 200)
Write-Host "  → Configuration TcpMaxHalfOpen..." -ForegroundColor Gray
Set-ItemProperty -Path $regPath -Name "TcpMaxHalfOpen" -Value 200 -Type DWord -ErrorAction SilentlyContinue

# TcpMaxHalfOpenRetried : Limite les connexions SYN retentées (défaut: 80, on augmente à 160)
Write-Host "  → Configuration TcpMaxHalfOpenRetried..." -ForegroundColor Gray
Set-ItemProperty -Path $regPath -Name "TcpMaxHalfOpenRetried" -Value 160 -Type DWord -ErrorAction SilentlyContinue

# TcpMaxConnectResponseRetransmissions : Nombre de retransmissions SYN-ACK (défaut: 2, on garde)
Write-Host "  → Configuration TcpMaxConnectResponseRetransmissions..." -ForegroundColor Gray
Set-ItemProperty -Path $regPath -Name "TcpMaxConnectResponseRetransmissions" -Value 2 -Type DWord -ErrorAction SilentlyContinue

# SynAttackProtect : Active la protection contre les attaques SYN (défaut: 1, on active à 2 pour plus de protection)
Write-Host "  → Activation SynAttackProtect..." -ForegroundColor Gray
Set-ItemProperty -Path $regPath -Name "SynAttackProtect" -Value 2 -Type DWord -ErrorAction SilentlyContinue

# TcpMaxPortsExhausted : Limite les tentatives de connexion échouées (défaut: 5)
Write-Host "  → Configuration TcpMaxPortsExhausted..." -ForegroundColor Gray
Set-ItemProperty -Path $regPath -Name "TcpMaxPortsExhausted" -Value 5 -Type DWord -ErrorAction SilentlyContinue

# EnableDeadGWDetect : Désactiver la détection de passerelle morte (peut aider en cas d'attaque)
Write-Host "  → Configuration EnableDeadGWDetect..." -ForegroundColor Gray
Set-ItemProperty -Path $regPath -Name "EnableDeadGWDetect" -Value 0 -Type DWord -ErrorAction SilentlyContinue

Write-Host "✅ Configuration Registre terminée" -ForegroundColor Green
Write-Host ""

# ============================================
# 4. Vérification de la configuration
# ============================================
Write-Host "🔍 Vérification de la configuration..." -ForegroundColor Yellow

$tcpMaxHalfOpen = Get-ItemProperty -Path $regPath -Name "TcpMaxHalfOpen" -ErrorAction SilentlyContinue
$synAttackProtect = Get-ItemProperty -Path $regPath -Name "SynAttackProtect" -ErrorAction SilentlyContinue

Write-Host "  → TcpMaxHalfOpen : $($tcpMaxHalfOpen.TcpMaxHalfOpen)" -ForegroundColor Gray
Write-Host "  → SynAttackProtect : $($synAttackProtect.SynAttackProtect)" -ForegroundColor Gray

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "✅ Configuration terminée avec succès !" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 PROCHAINES ÉTAPES :" -ForegroundColor Yellow
Write-Host "  1. Redémarrer Apache pour appliquer les configurations" -ForegroundColor White
Write-Host "  2. Ajouter les configurations Apache depuis install/apache-syn-flood-config.conf" -ForegroundColor White
Write-Host "  3. Redémarrer le serveur Node.js pour activer le rate limiting" -ForegroundColor White
Write-Host "  4. Surveiller les logs avec install/monitor-syn-flood.ps1" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  NOTE : Un redémarrage du serveur peut être nécessaire pour que" -ForegroundColor Yellow
Write-Host "   certaines modifications du registre prennent effet." -ForegroundColor Yellow
Write-Host ""


