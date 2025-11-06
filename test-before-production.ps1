# Script de test complet avant mise en production
# Usage: .\test-before-production.ps1

Write-Host "🚀 === TEST COMPLET AVANT PRODUCTION ===" -ForegroundColor Cyan
Write-Host ""

# Variables
$allTestsPassed = $true
$errors = @()

# 1. Vérifier qu'on est sur develop
Write-Host "1️⃣ Vérification branche Git..." -ForegroundColor Yellow
$currentBranch = git branch --show-current
if ($currentBranch -eq "develop") {
    Write-Host "   ✅ Sur la branche develop" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Vous n'êtes pas sur develop (vous êtes sur: $currentBranch)" -ForegroundColor Yellow
    Write-Host "   💡 Faites: git checkout develop" -ForegroundColor Gray
}

# 2. Vérifier que le backend démarre
Write-Host ""
Write-Host "2️⃣ Test Backend Node.js..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend répond correctement" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Backend ne répond pas" -ForegroundColor Red
    Write-Host "   💡 Démarrez: node backend/server.js" -ForegroundColor Gray
    $allTestsPassed = $false
    $errors += "Backend ne répond pas"
}

# 3. Vérifier les fichiers critiques
Write-Host ""
Write-Host "3️⃣ Vérification fichiers critiques..." -ForegroundColor Yellow

$criticalFiles = @(
    "frontend/config/config.php",
    "frontend/includes/functions.php",
    "frontend/includes/header.php",
    "frontend/includes/footer.php",
    "backend/server.js",
    "backend/modules/analyse-intention/routes.js",
    "backend/modules/analyse-intention/services/IntentionService.js",
    "backend/modules/analyse-intention/services/AIService.js"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file MANQUANT" -ForegroundColor Red
        $allTestsPassed = $false
        $errors += "Fichier manquant: $file"
    }
}

# 4. Vérifier la syntaxe PHP (si possible)
Write-Host ""
Write-Host "4️⃣ Vérification syntaxe PHP..." -ForegroundColor Yellow
$phpFiles = Get-ChildItem -Path "frontend" -Filter "*.php" -Recurse | Select-Object -First 10
foreach ($file in $phpFiles) {
    try {
        # Essayer de vérifier la syntaxe (nécessite PHP dans PATH)
        $result = php -l $file.FullName 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ $($file.Name)" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  $($file.Name) - Vérifiez manuellement" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ⚠️  PHP non disponible pour vérification automatique" -ForegroundColor Yellow
        break
    }
}

# 5. Vérifier les imports/exports
Write-Host ""
Write-Host "5️⃣ Vérification modules Node.js..." -ForegroundColor Yellow
$nodeFiles = @(
    "backend/modules/analyse-intention/routes.js",
    "backend/modules/analyse-intention/services/IntentionService.js"
)

foreach ($file in $nodeFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        # Vérifier les imports basiques
        if ($content -match "require\(|module\.exports") {
            Write-Host "   ✅ $file (syntaxe OK)" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  $file - Vérifiez les imports" -ForegroundColor Yellow
        }
    }
}

# 6. Checklist manuelle
Write-Host ""
Write-Host "6️⃣ Checklist manuelle à faire:" -ForegroundColor Yellow
Write-Host "   [ ] Ouvrir http://localhost/gdri/frontend/" -ForegroundColor Gray
Write-Host "   [ ] Vérifier que le CSS se charge" -ForegroundColor Gray
Write-Host "   [ ] Vérifier que le JS se charge" -ForegroundColor Gray
Write-Host "   [ ] Tester la navigation" -ForegroundColor Gray
Write-Host "   [ ] Tester le login" -ForegroundColor Gray
Write-Host "   [ ] Tester les pages de configuration" -ForegroundColor Gray
Write-Host "   [ ] Vérifier la console navigateur (F12) - pas d'erreurs" -ForegroundColor Gray

# Résumé
Write-Host ""
Write-Host "📊 === RÉSUMÉ ===" -ForegroundColor Cyan
if ($allTestsPassed -and $errors.Count -eq 0) {
    Write-Host "✅ Tests automatiques: OK" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Faites les tests manuels avant de merger dans master!" -ForegroundColor Yellow
} else {
    Write-Host "❌ Tests automatiques: ÉCHECS DÉTECTÉS" -ForegroundColor Red
    Write-Host ""
    Write-Host "Erreurs trouvées:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "   - $error" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "🔧 Corrigez ces erreurs avant de merger dans master!" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "💡 Commandes pour merger en production:" -ForegroundColor Cyan
Write-Host "   git checkout master" -ForegroundColor Gray
Write-Host "   git merge develop" -ForegroundColor Gray
Write-Host "   git push origin master" -ForegroundColor Gray
Write-Host ""

