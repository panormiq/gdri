# Script de test frontend
# Usage: .\test-frontend.ps1

Write-Host "🧪 === TEST FRONTEND ===" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier les fichiers CSS
Write-Host "1️⃣ Vérification fichiers CSS..." -ForegroundColor Yellow
$cssFiles = @(
    "frontend/assets/css/main.css",
    "frontend/assets/css/modal.css",
    "frontend/assets/css/responsive.css"
)

foreach ($cssFile in $cssFiles) {
    if (Test-Path $cssFile) {
        $size = (Get-Item $cssFile).Length
        Write-Host "   ✅ $cssFile ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $cssFile MANQUANT" -ForegroundColor Red
    }
}

# 2. Vérifier les fichiers JS
Write-Host ""
Write-Host "2️⃣ Vérification fichiers JavaScript..." -ForegroundColor Yellow
$jsFiles = @(
    "frontend/assets/js/main.js",
    "frontend/assets/js/navigation.js",
    "frontend/assets/js/modal.js",
    "frontend/assets/js/form-validation.js"
)

foreach ($jsFile in $jsFiles) {
    if (Test-Path $jsFile) {
        $size = (Get-Item $jsFile).Length
        Write-Host "   ✅ $jsFile ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $jsFile MANQUANT" -ForegroundColor Red
    }
}

# 3. Vérifier les images
Write-Host ""
Write-Host "3️⃣ Vérification images..." -ForegroundColor Yellow
$imageFiles = @(
    "frontend/assets/images/logo-gdri.png"
)

foreach ($imageFile in $imageFiles) {
    if (Test-Path $imageFile) {
        $size = (Get-Item $imageFile).Length
        Write-Host "   ✅ $imageFile ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  $imageFile MANQUANT" -ForegroundColor Yellow
    }
}

# 4. Vérifier les fichiers PHP critiques
Write-Host ""
Write-Host "4️⃣ Vérification fichiers PHP critiques..." -ForegroundColor Yellow
$phpFiles = @(
    "frontend/config/config.php",
    "frontend/includes/functions.php",
    "frontend/includes/header.php",
    "frontend/includes/footer.php",
    "frontend/index.php",
    "frontend/pages/dashboard.php",
    "frontend/pages/modules.php"
)

foreach ($phpFile in $phpFiles) {
    if (Test-Path $phpFile) {
        Write-Host "   ✅ $phpFile" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $phpFile MANQUANT" -ForegroundColor Red
    }
}

# 5. Vérifier la fonction getBaseUrl
Write-Host ""
Write-Host "5️⃣ Vérification fonction getBaseUrl..." -ForegroundColor Yellow
$configContent = Get-Content "frontend/config/config.php" -Raw
if ($configContent -match "function getBaseUrl") {
    Write-Host "   ✅ Fonction getBaseUrl() présente" -ForegroundColor Green
} else {
    Write-Host "   ❌ Fonction getBaseUrl() MANQUANTE" -ForegroundColor Red
}

# 6. Vérifier la fonction url()
Write-Host ""
Write-Host "6️⃣ Vérification fonction url()..." -ForegroundColor Yellow
$functionsContent = Get-Content "frontend/includes/functions.php" -Raw
if ($functionsContent -match "function url\(") {
    Write-Host "   ✅ Fonction url() présente" -ForegroundColor Green
} else {
    Write-Host "   ❌ Fonction url() MANQUANTE" -ForegroundColor Red
}

# 7. Instructions pour test manuel
Write-Host ""
Write-Host "📋 === TEST MANUEL À FAIRE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Ouvrez votre navigateur" -ForegroundColor Yellow
Write-Host "2. Allez sur: http://localhost/gdri/frontend/" -ForegroundColor Gray
Write-Host "3. Ouvrez la console (F12)" -ForegroundColor Gray
Write-Host "4. Vérifiez:" -ForegroundColor Gray
Write-Host "   - Pas d'erreurs en rouge dans la console" -ForegroundColor Gray
Write-Host "   - Onglet Network: tous les fichiers CSS/JS chargent (200)" -ForegroundColor Gray
Write-Host "   - La page est stylée (CSS chargé)" -ForegroundColor Gray
Write-Host "   - Les liens fonctionnent" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Testez les URLs:" -ForegroundColor Yellow
Write-Host "   http://localhost/gdri/frontend/test-urls.php" -ForegroundColor Gray
Write-Host "   Vérifiez que BASE_URL = /gdri/frontend/" -ForegroundColor Gray
Write-Host ""
Write-Host "6. Testez les pages principales:" -ForegroundColor Yellow
Write-Host "   - Dashboard" -ForegroundColor Gray
Write-Host "   - Modules" -ForegroundColor Gray
Write-Host "   - Agents" -ForegroundColor Gray
Write-Host "   - Contact" -ForegroundColor Gray
Write-Host ""
Write-Host "7. Testez les pages de configuration:" -ForegroundColor Yellow
Write-Host "   - Mail config" -ForegroundColor Gray
Write-Host "   - Analyse intention config" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Si tout fonctionne, vous pouvez merger dans master!" -ForegroundColor Green
Write-Host ""

