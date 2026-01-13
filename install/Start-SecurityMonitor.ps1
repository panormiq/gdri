# Script PowerShell pour démarrer le Security Monitor
# Fichier : install/Start-SecurityMonitor.ps1

Write-Host "🔒 Démarrage du Security Monitor..." -ForegroundColor Cyan

# Vérifier que Node.js est installé
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    exit 1
}

# Aller dans le répertoire du projet
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Vérifier que le fichier .env existe
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Fichier .env non trouvé" -ForegroundColor Yellow
    Write-Host "📝 Créez un fichier .env avec les variables suivantes :" -ForegroundColor Yellow
    Write-Host "   SMTP_HOST=smtp.gmail.com" -ForegroundColor Gray
    Write-Host "   SMTP_PORT=587" -ForegroundColor Gray
    Write-Host "   SMTP_USER=votre-email@gmail.com" -ForegroundColor Gray
    Write-Host "   SMTP_PASS=votre-mot-de-passe-app" -ForegroundColor Gray
    Write-Host "   SECURITY_ALERT_EMAIL=admin@gdri.fr" -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "Continuer quand même ? (o/N)"
    if ($continue -ne "o" -and $continue -ne "O") {
        exit 0
    }
}

# Vérifier que MongoDB est accessible
Write-Host "🔍 Vérification de la connexion MongoDB..." -ForegroundColor Cyan
try {
    $mongoTest = node -e "const { MongoClient } = require('mongodb'); const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://gdri_admin:gdri2024@localhost:27017/GDR-INNOVATION?authSource=GDR-INNOVATION'); client.connect().then(() => { console.log('OK'); client.close(); process.exit(0); }).catch(e => { console.error('ERREUR:', e.message); process.exit(1); });"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Impossible de se connecter à MongoDB" -ForegroundColor Yellow
        Write-Host "   Le monitoring peut fonctionner mais les alertes par email nécessitent MongoDB" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Connexion MongoDB OK" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Erreur lors de la vérification MongoDB: $_" -ForegroundColor Yellow
}

# Démarrer le monitoring
Write-Host ""
Write-Host "🚀 Démarrage du Security Monitor..." -ForegroundColor Cyan
Write-Host "   Appuyez sur Ctrl+C pour arrêter" -ForegroundColor Gray
Write-Host ""

node backend/security-monitor.js


