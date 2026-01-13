# Script de diagnostic complet pour le reverse proxy API
# Vérifie le backend et la configuration Apache

Write-Host "🔍 DIAGNOSTIC COMPLET DU REVERSE PROXY API" -ForegroundColor Cyan
Write-Host "=" -repeat 60 -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier si le backend écoute sur le port 3000
Write-Host "1️⃣  Vérification du backend Node.js (port 3000)..." -ForegroundColor Yellow
$backendCheck = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($backendCheck) {
    Write-Host "   ✅ Backend écoute sur le port 3000" -ForegroundColor Green
    Write-Host "   Processus PID: $($backendCheck.OwningProcess)" -ForegroundColor Gray
} else {
    Write-Host "   ❌ Backend N'ÉCOUTE PAS sur le port 3000" -ForegroundColor Red
    Write-Host "   → Le backend Node.js doit être démarré avant de continuer" -ForegroundColor Yellow
    Write-Host "   → Commandes: cd backend && npm run dev" -ForegroundColor Gray
}

# 2. Tester la connexion directe au backend
Write-Host ""
Write-Host "2️⃣  Test de connexion directe au backend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend répond correctement (HTTP $($response.StatusCode))" -ForegroundColor Green
        try {
            $json = $response.Content | ConvertFrom-Json
            Write-Host "   📊 Statut: $($json.status)" -ForegroundColor Gray
            Write-Host "   📦 Modules: $($json.modules)" -ForegroundColor Gray
        } catch {
            Write-Host "   Réponse: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "   ❌ Impossible de se connecter au backend" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   → Vérifiez que le backend est démarré: npm run dev" -ForegroundColor Yellow
}

# 3. Tester les routes spécifiques
Write-Host ""
Write-Host "3️⃣  Test des routes API spécifiques..." -ForegroundColor Yellow

$routes = @(
    "/api/analyse",
    "/api/mail/config/mail",
    "/api/analyse/agent-config"
)

foreach ($route in $routes) {
    try {
        $url = "http://127.0.0.1:3000$route"
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        Write-Host "   ✅ $route : HTTP $($response.StatusCode)" -ForegroundColor Green
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 401 -or $status -eq 403) {
            Write-Host "   ⚠️  $route : HTTP $status (Authentification requise - Normal)" -ForegroundColor Yellow
        } elseif ($status -eq 404) {
            Write-Host "   ❌ $route : HTTP $status (Route non trouvée)" -ForegroundColor Red
        } else {
            Write-Host "   ⚠️  $route : Erreur $status" -ForegroundColor Yellow
        }
    }
}

# 4. Vérifier les fichiers de configuration Apache
Write-Host ""
Write-Host "4️⃣  Vérification des fichiers de configuration Apache..." -ForegroundColor Yellow

$httpdConf = "C:\xampp\apache\conf\httpd.conf"
$vhostsConf = "C:\xampp\apache\conf\extra\httpd-vhosts.conf"

# Vérifier httpd.conf pour les modules proxy
if (Test-Path $httpdConf) {
    Write-Host "   ✅ httpd.conf trouvé" -ForegroundColor Green
    
    $proxyModule = Select-String -Path $httpdConf -Pattern "^LoadModule proxy_module" -Quiet
    $proxyHttpModule = Select-String -Path $httpdConf -Pattern "^LoadModule proxy_http_module" -Quiet
    
    if ($proxyModule) {
        Write-Host "   ✅ Module proxy activé" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Module proxy NON activé dans httpd.conf" -ForegroundColor Red
        Write-Host "      → Ajoutez: LoadModule proxy_module modules/mod_proxy.so" -ForegroundColor Yellow
    }
    
    if ($proxyHttpModule) {
        Write-Host "   ✅ Module proxy_http activé" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Module proxy_http NON activé dans httpd.conf" -ForegroundColor Red
        Write-Host "      → Ajoutez: LoadModule proxy_http_module modules/mod_proxy_http.so" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ httpd.conf non trouvé à: $httpdConf" -ForegroundColor Red
}

# Vérifier httpd-vhosts.conf pour le VirtualHost 443
if (Test-Path $vhostsConf) {
    Write-Host "   ✅ httpd-vhosts.conf trouvé" -ForegroundColor Green
    
    $content = Get-Content $vhostsConf -Raw
    $hasVHost443 = $content -match "VirtualHost.*:443"
    $hasProxyPass = $content -match "ProxyPass.*/api/.*3000"
    
    if ($hasVHost443) {
        Write-Host "   ✅ VirtualHost *:443 trouvé" -ForegroundColor Green
        
        if ($hasProxyPass) {
            Write-Host "   ✅ Reverse proxy configuré pour /api/" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Reverse proxy NON configuré dans le VirtualHost 443" -ForegroundColor Red
            Write-Host "      → Ajoutez dans le VirtualHost *:443:" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "      ProxyPreserveHost On" -ForegroundColor Gray
            Write-Host "      ProxyPass /api/ http://127.0.0.1:3000/api/" -ForegroundColor Gray
            Write-Host "      ProxyPassReverse /api/ http://127.0.0.1:3000/api/" -ForegroundColor Gray
            Write-Host "      RequestHeader set X-Forwarded-Proto `"https`"" -ForegroundColor Gray
            Write-Host ""
        }
    } else {
        Write-Host "   ❌ VirtualHost *:443 NON trouvé" -ForegroundColor Red
        Write-Host "      → Créez un VirtualHost pour le port 443 avec SSL" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ httpd-vhosts.conf non trouvé à: $vhostsConf" -ForegroundColor Red
}

# 5. Tester via HTTPS (reverse proxy)
Write-Host ""
Write-Host "5️⃣  Test du reverse proxy via HTTPS..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://www.gdri.fr/api/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop -SkipCertificateCheck
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Reverse proxy fonctionne correctement !" -ForegroundColor Green
        try {
            $json = $response.Content | ConvertFrom-Json
            Write-Host "   📊 Statut backend: $($json.status)" -ForegroundColor Gray
        } catch {
            Write-Host "   Réponse: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))" -ForegroundColor Gray
        }
    }
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 404) {
        Write-Host "   ❌ Erreur 404 : Le reverse proxy n'est PAS configuré ou ne fonctionne pas" -ForegroundColor Red
        Write-Host "      → Vérifiez la configuration Apache et redémarrez Apache" -ForegroundColor Yellow
    } else {
        Write-Host "   ❌ Erreur HTTP $status : $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Résumé et actions
Write-Host ""
Write-Host "=" -repeat 60 -ForegroundColor Cyan
Write-Host "📋 ACTIONS À EFFECTUER:" -ForegroundColor Cyan
Write-Host ""

if (-not $backendCheck) {
    Write-Host "1. Démarrez le backend Node.js:" -ForegroundColor White
    Write-Host "   cd backend && npm run dev" -ForegroundColor Gray
    Write-Host ""
}

if (-not $hasProxyPass) {
    Write-Host "2. Configurez le reverse proxy dans httpd-vhosts.conf:" -ForegroundColor White
    Write-Host "   Ouvrez: C:\xampp\apache\conf\extra\httpd-vhosts.conf" -ForegroundColor Gray
    Write-Host "   Ajoutez dans le VirtualHost *:443:" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   ProxyPreserveHost On" -ForegroundColor Yellow
    Write-Host "   ProxyPass /api/ http://127.0.0.1:3000/api/" -ForegroundColor Yellow
    Write-Host "   ProxyPassReverse /api/ http://127.0.0.1:3000/api/" -ForegroundColor Yellow
    Write-Host "   RequestHeader set X-Forwarded-Proto `"https`"" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Voir le fichier de référence: install/apache-vhost.conf" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "3. Redémarrez Apache après modification:" -ForegroundColor White
Write-Host "   XAMPP Control Panel → Stop Apache → Start Apache" -ForegroundColor Gray
Write-Host ""

Write-Host "4. Relancez ce script pour vérifier:" -ForegroundColor White
Write-Host "   .\install\diagnostic-proxy-api.ps1" -ForegroundColor Gray
Write-Host ""
