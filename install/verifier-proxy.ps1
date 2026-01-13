# Script de vérification du reverse proxy Apache
# Vérifie que le backend est accessible et que le proxy est configuré

Write-Host "🔍 Diagnostic du reverse proxy Apache" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier si le backend écoute sur le port 3000
Write-Host "1. Vérification du backend (port 3000)..." -ForegroundColor Yellow
$backendCheck = netstat -an | Select-String ":3000" | Select-String "LISTENING"
if ($backendCheck) {
    Write-Host "   ✅ Backend écoute sur le port 3000" -ForegroundColor Green
} else {
    Write-Host "   ❌ Backend N'ÉCOUTE PAS sur le port 3000" -ForegroundColor Red
    Write-Host "   → Vérifiez que le backend est bien démarré" -ForegroundColor Yellow
}

# 2. Tester la connexion directe au backend
Write-Host ""
Write-Host "2. Test de connexion directe au backend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend répond correctement" -ForegroundColor Green
        Write-Host "   Réponse: $($response.Content)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Impossible de se connecter au backend" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Vérifier les fichiers de configuration Apache
Write-Host ""
Write-Host "3. Vérification des fichiers de configuration Apache..." -ForegroundColor Yellow

$httpdConf = "C:\xampp\apache\conf\httpd.conf"
$vhostsConf = "C:\xampp\apache\conf\extra\httpd-vhosts.conf"

if (Test-Path $httpdConf) {
    Write-Host "   ✅ httpd.conf trouvé" -ForegroundColor Green
    
    # Vérifier les modules proxy
    $proxyModule = Select-String -Path $httpdConf -Pattern "^LoadModule proxy_module" -Quiet
    $proxyHttpModule = Select-String -Path $httpdConf -Pattern "^LoadModule proxy_http_module" -Quiet
    
    if ($proxyModule) {
        Write-Host "   ✅ Module proxy_module activé" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Module proxy_module NON activé" -ForegroundColor Red
        Write-Host "   → Décommentez: LoadModule proxy_module modules/mod_proxy.so" -ForegroundColor Yellow
    }
    
    if ($proxyHttpModule) {
        Write-Host "   ✅ Module proxy_http_module activé" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Module proxy_http_module NON activé" -ForegroundColor Red
        Write-Host "   → Décommentez: LoadModule proxy_http_module modules/mod_proxy_http.so" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ httpd.conf non trouvé à: $httpdConf" -ForegroundColor Red
}

if (Test-Path $vhostsConf) {
    Write-Host "   ✅ httpd-vhosts.conf trouvé" -ForegroundColor Green
    
    # Vérifier si le VirtualHost pour www.gdri.fr existe
    $vhost443 = Select-String -Path $vhostsConf -Pattern "VirtualHost.*:443" -Context 0,30
    if ($vhost443) {
        $hasProxy = $vhost443 | Select-String -Pattern "ProxyPass.*3000" -Quiet
        if ($hasProxy) {
            Write-Host "   ✅ Reverse proxy configuré pour le port 443" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Reverse proxy NON configuré dans le VirtualHost 443" -ForegroundColor Red
            Write-Host "   → Ajoutez les lignes ProxyPass dans le VirtualHost *:443" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⚠️  VirtualHost *:443 non trouvé" -ForegroundColor Yellow
        Write-Host "   → Vérifiez que le VirtualHost HTTPS existe" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ httpd-vhosts.conf non trouvé à: $vhostsConf" -ForegroundColor Red
}

# 4. Vérifier les logs Apache
Write-Host ""
Write-Host "4. Vérification des logs Apache..." -ForegroundColor Yellow
$errorLog = "C:\xampp\apache\logs\error.log"
$sslErrorLog = "C:\xampp\apache\logs\gdri-ssl-error.log"

if (Test-Path $errorLog) {
    Write-Host "   ✅ error.log trouvé" -ForegroundColor Green
    $recentErrors = Get-Content $errorLog -Tail 5 | Select-String -Pattern "proxy|ProxyPass|3000" -CaseSensitive:$false
    if ($recentErrors) {
        Write-Host "   ⚠️  Erreurs récentes liées au proxy:" -ForegroundColor Yellow
        $recentErrors | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
    }
}

if (Test-Path $sslErrorLog) {
    Write-Host "   ✅ gdri-ssl-error.log trouvé" -ForegroundColor Green
    $pattern = 'proxy|ProxyPass|3000|503'
    $recentSslErrors = Get-Content $sslErrorLog -Tail 5 | Select-String -Pattern $pattern
    if ($recentSslErrors) {
        Write-Host "   ⚠️  Erreurs récentes SSL liées au proxy:" -ForegroundColor Yellow
        $recentSslErrors | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
    }
}

Write-Host ""
Write-Host "📋 Résumé des actions à effectuer:" -ForegroundColor Cyan
Write-Host "   1. Vérifiez que les modules proxy sont activés dans httpd.conf" -ForegroundColor White
Write-Host "   2. Vérifiez que le VirtualHost *:443 contient:" -ForegroundColor White
Write-Host "      <LocationMatch \"^/api/\">" -ForegroundColor Gray
Write-Host "          ProxyPass http://127.0.0.1:3000/api/" -ForegroundColor Gray
Write-Host "          ProxyPassReverse http://127.0.0.1:3000/api/" -ForegroundColor Gray
Write-Host "          ProxyPreserveHost On" -ForegroundColor Gray
Write-Host "      </LocationMatch>" -ForegroundColor Gray
Write-Host "   3. Redémarrez Apache après modification" -ForegroundColor White
Write-Host ""
Write-Host "💡 Fichier de référence: install/apache-vhost.conf" -ForegroundColor Cyan

