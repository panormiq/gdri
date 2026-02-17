# Script de test pour vérifier que le backend UGAP fonctionne
# Usage: .\test-backend.ps1

Write-Host "=== Test Backend UGAP ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Vérifier que le backend répond
Write-Host "1. Test du backend sur localhost:3000..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✅ Backend accessible" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
    $json = $response.Content | ConvertFrom-Json
    Write-Host "   Modules chargés: $($json.loadedModules -join ', ')" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Backend non accessible: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   → Vérifiez que le backend Node.js est démarré" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Test 2: Vérifier le module UGAP
Write-Host "2. Test du module UGAP..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/ugap/health" -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✅ Module UGAP accessible" -ForegroundColor Green
    $json = $response.Content | ConvertFrom-Json
    Write-Host "   Message: $($json.message)" -ForegroundColor Gray
    Write-Host "   Version: $($json.version)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Module UGAP non accessible: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   → Vérifiez que le module est chargé dans les logs du backend" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Test 3: Vérifier via le reverse proxy (si accessible)
Write-Host "3. Test via reverse proxy (https://www.gdr-innovation.fr)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://www.gdr-innovation.fr/api/health" -UseBasicParsing -ErrorAction Stop -SkipCertificateCheck
    Write-Host "   ✅ Reverse proxy fonctionne" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠️  Reverse proxy non accessible: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "   → Vérifiez la configuration Apache (voir TROUBLESHOOTING.md)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Tests terminés ===" -ForegroundColor Cyan
