# Script de test rapide pour vérifier que tout fonctionne
# Usage: .\test-quick.ps1

Write-Host "🧪 === TEST RAPIDE GDRI ===" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier que le backend Node.js peut démarrer
Write-Host "1️⃣ Test Backend Node.js..." -ForegroundColor Yellow
$backendRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend Node.js est démarré" -ForegroundColor Green
        $backendRunning = $true
    }
} catch {
    Write-Host "   ⚠️  Backend Node.js n'est pas démarré (normal si pas lancé)" -ForegroundColor Yellow
}

# 2. Vérifier que MongoDB est accessible
Write-Host ""
Write-Host "2️⃣ Test MongoDB..." -ForegroundColor Yellow
try {
    $mongoProcess = Get-Process -Name "mongod" -ErrorAction SilentlyContinue
    if ($mongoProcess) {
        Write-Host "   ✅ MongoDB est démarré" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  MongoDB ne semble pas démarré" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Impossible de vérifier MongoDB" -ForegroundColor Yellow
}

# 3. Vérifier les fichiers critiques
Write-Host ""
Write-Host "3️⃣ Vérification fichiers critiques..." -ForegroundColor Yellow

$criticalFiles = @(
    "frontend/config/config.php",
    "frontend/includes/functions.php",
    "frontend/includes/header.php",
    "backend/server.js",
    "backend/modules/analyse-intention/routes.js"
)

$allOk = $true
foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file MANQUANT" -ForegroundColor Red
        $allOk = $false
    }
}

# 4. Vérifier les URLs générées
Write-Host ""
Write-Host "4️⃣ Test URLs (ouvrez http://localhost/gdri/frontend/test-urls.php)" -ForegroundColor Yellow
Write-Host "   Vérifiez que BASE_URL est correct" -ForegroundColor Gray

# 5. Résumé
Write-Host ""
Write-Host "📊 === RÉSUMÉ ===" -ForegroundColor Cyan
if ($allOk) {
    Write-Host "✅ Fichiers critiques: OK" -ForegroundColor Green
} else {
    Write-Host "❌ Fichiers critiques: PROBLÈMES DÉTECTÉS" -ForegroundColor Red
}

if ($backendRunning) {
    Write-Host "✅ Backend: OK" -ForegroundColor Green
} else {
    Write-Host "⚠️  Backend: Non testé (démarrez avec: node backend/server.js)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "💡 Pour tester complètement:" -ForegroundColor Cyan
Write-Host "   1. Démarrez le backend: node backend/server.js" -ForegroundColor Gray
Write-Host "   2. Ouvrez: http://localhost/gdri/frontend/" -ForegroundColor Gray
Write-Host "   3. Testez les pages principales" -ForegroundColor Gray
Write-Host "   4. Vérifiez la console navigateur (F12)" -ForegroundColor Gray
Write-Host ""

