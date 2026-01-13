# Script de verification du reverse proxy Apache
Write-Host "Diagnostic du reverse proxy Apache" -ForegroundColor Cyan
Write-Host ""

# 1. Verifier si le backend ecoute sur le port 3000
Write-Host "1. Verification du backend (port 3000)..." -ForegroundColor Yellow
$backendCheck = netstat -an | Select-String ":3000" | Select-String "LISTENING"
if ($backendCheck) {
    Write-Host "   OK: Backend ecoute sur le port 3000" -ForegroundColor Green
} else {
    Write-Host "   ERREUR: Backend N'ECOUTE PAS sur le port 3000" -ForegroundColor Red
}

# 2. Tester la connexion directe au backend
Write-Host ""
Write-Host "2. Test de connexion directe au backend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   OK: Backend repond correctement" -ForegroundColor Green
    }
} catch {
    Write-Host "   ERREUR: Impossible de se connecter au backend" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Verifier les fichiers de configuration Apache
Write-Host ""
Write-Host "3. Verification des fichiers de configuration Apache..." -ForegroundColor Yellow

$httpdConf = "C:\xampp\apache\conf\httpd.conf"
$vhostsConf = "C:\xampp\apache\conf\extra\httpd-vhosts.conf"

if (Test-Path $httpdConf) {
    Write-Host "   OK: httpd.conf trouve" -ForegroundColor Green
    
    # Verifier les modules proxy
    $proxyModule = Select-String -Path $httpdConf -Pattern "^LoadModule proxy_module" -Quiet
    $proxyHttpModule = Select-String -Path $httpdConf -Pattern "^LoadModule proxy_http_module" -Quiet
    
    if ($proxyModule) {
        Write-Host "   OK: Module proxy_module active" -ForegroundColor Green
    } else {
        Write-Host "   ERREUR: Module proxy_module NON active" -ForegroundColor Red
        Write-Host "   -> Decommentez: LoadModule proxy_module modules/mod_proxy.so" -ForegroundColor Yellow
    }
    
    if ($proxyHttpModule) {
        Write-Host "   OK: Module proxy_http_module active" -ForegroundColor Green
    } else {
        Write-Host "   ERREUR: Module proxy_http_module NON active" -ForegroundColor Red
        Write-Host "   -> Decommentez: LoadModule proxy_http_module modules/mod_proxy_http.so" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ERREUR: httpd.conf non trouve a: $httpdConf" -ForegroundColor Red
}

if (Test-Path $vhostsConf) {
    Write-Host "   OK: httpd-vhosts.conf trouve" -ForegroundColor Green
    
    # Verifier si le VirtualHost pour www.gdri.fr existe
    $vhost443 = Select-String -Path $vhostsConf -Pattern "VirtualHost.*:443" -Context 0,30
    if ($vhost443) {
        $hasProxy = $vhost443 | Select-String -Pattern "ProxyPass.*3000" -Quiet
        if ($hasProxy) {
            Write-Host "   OK: Reverse proxy configure pour le port 443" -ForegroundColor Green
        } else {
            Write-Host "   ERREUR: Reverse proxy NON configure dans le VirtualHost 443" -ForegroundColor Red
            Write-Host "   -> Ajoutez les lignes ProxyPass dans le VirtualHost *:443" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "   Configuration a ajouter:" -ForegroundColor Cyan
            Write-Host "   <LocationMatch `"^/api/`">" -ForegroundColor Gray
            Write-Host "       ProxyPass http://127.0.0.1:3000/api/" -ForegroundColor Gray
            Write-Host "       ProxyPassReverse http://127.0.0.1:3000/api/" -ForegroundColor Gray
            Write-Host "       ProxyPreserveHost On" -ForegroundColor Gray
            Write-Host "   </LocationMatch>" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ATTENTION: VirtualHost *:443 non trouve" -ForegroundColor Yellow
        Write-Host "   -> Verifiez que le VirtualHost HTTPS existe" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ERREUR: httpd-vhosts.conf non trouve a: $vhostsConf" -ForegroundColor Red
}

Write-Host ""
Write-Host "Fichier de reference: install/apache-vhost.conf" -ForegroundColor Cyan


