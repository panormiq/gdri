# Script pour vérifier et corriger la configuration VirtualHost
# Usage: .\fix-vhost.ps1

$vhostFile = "C:\xampp\apache\conf\extra\httpd-vhosts.conf"

Write-Host "=== Vérification VirtualHost Apache ===" -ForegroundColor Cyan
Write-Host ""

# Vérifier que le fichier existe
if (-not (Test-Path $vhostFile)) {
    Write-Host "❌ Fichier non trouvé: $vhostFile" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Lecture du fichier: $vhostFile" -ForegroundColor Yellow
$content = Get-Content $vhostFile -Raw

# Vérifier la présence du VirtualHost 443
if ($content -notmatch '<VirtualHost \*:443>') {
    Write-Host "❌ VirtualHost *:443 non trouvé" -ForegroundColor Red
    Write-Host "   → Ajoutez la configuration HTTPS dans httpd-vhosts.conf" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ VirtualHost *:443 trouvé" -ForegroundColor Green

# Vérifier ProxyPass
if ($content -match 'ProxyPass\s+/api') {
    Write-Host "✅ ProxyPass /api trouvé" -ForegroundColor Green
    
    # Vérifier si c'est avec ou sans slash final
    if ($content -match 'ProxyPass\s+/api/\s+http://127\.0\.0\.1:3000/api/') {
        Write-Host "✅ Configuration correcte: ProxyPass /api/ avec slash final" -ForegroundColor Green
    } elseif ($content -match 'ProxyPass\s+/api\s+http://127\.0\.0\.1:3000/api') {
        Write-Host "⚠️  Configuration sans slash final détectée" -ForegroundColor Yellow
        Write-Host "   → Recommandation: Utiliser ProxyPass /api/ http://127.0.0.1:3000/api/" -ForegroundColor Yellow
        Write-Host "   → Voir CORRECTION-PROXYPASS.md pour plus de détails" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Configuration ProxyPass peut être incorrecte" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ ProxyPass /api non trouvé" -ForegroundColor Red
    Write-Host "   → Ajoutez les directives ProxyPass dans le VirtualHost 443" -ForegroundColor Yellow
    exit 1
}

# Vérifier ProxyPassReverse
if ($content -match 'ProxyPassReverse\s+/api/') {
    Write-Host "✅ ProxyPassReverse /api/ trouvé" -ForegroundColor Green
} else {
    Write-Host "⚠️  ProxyPassReverse /api/ non trouvé" -ForegroundColor Yellow
}

# Vérifier ProxyPreserveHost
if ($content -match 'ProxyPreserveHost\s+On') {
    Write-Host "✅ ProxyPreserveHost On trouvé" -ForegroundColor Green
} else {
    Write-Host "⚠️  ProxyPreserveHost On non trouvé" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Test du backend ===" -ForegroundColor Cyan

# Tester le backend directement
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Backend accessible sur localhost:3000" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend non accessible sur localhost:3000" -ForegroundColor Red
    Write-Host "   → Démarrez le backend Node.js" -ForegroundColor Yellow
    Write-Host "   → Commande: cd C:\xampp\htdocs\gdri\backend && node server.js" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Recommandations ===" -ForegroundColor Cyan
Write-Host "1. Vérifiez que le backend Node.js est démarré" -ForegroundColor Yellow
Write-Host "2. Vérifiez l'ordre des directives dans httpd-vhosts.conf:" -ForegroundColor Yellow
Write-Host "   - ProxyPass doit être AVANT <Directory>" -ForegroundColor Gray
Write-Host "3. Redémarrez Apache après modification" -ForegroundColor Yellow
Write-Host "4. Testez avec: .\test-backend.ps1" -ForegroundColor Yellow
