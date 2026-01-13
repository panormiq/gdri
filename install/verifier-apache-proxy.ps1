# Script PowerShell pour vérifier la configuration Apache du reverse proxy
# Usage: .\install\verifier-apache-proxy.ps1

Write-Host "🔍 Vérification de la configuration Apache pour le reverse proxy..." -ForegroundColor Cyan
Write-Host ""

$apacheConfPath = "C:\xampp\apache\conf\httpd.conf"
$vhostConfPath = "C:\xampp\apache\conf\extra\httpd-vhosts.conf"

# 1. Verifier que les modules proxy sont actives
Write-Host "1. Verification des modules proxy dans httpd.conf..." -ForegroundColor Yellow
if (Test-Path $apacheConfPath) {
    $content = Get-Content $apacheConfPath -Raw
    
    $proxyModule = $content -match 'LoadModule proxy_module'
    $proxyHttpModule = $content -match 'LoadModule proxy_http_module'
    
    if ($proxyModule -and !($content -match '#\s*LoadModule proxy_module')) {
        Write-Host "   ✅ Module proxy_module activé" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Module proxy_module NON activé ou commenté" -ForegroundColor Red
        Write-Host "   💡 Ajoutez: LoadModule proxy_module modules/mod_proxy.so" -ForegroundColor Yellow
    }
    
    if ($proxyHttpModule -and !($content -match '#\s*LoadModule proxy_http_module')) {
        Write-Host "   ✅ Module proxy_http_module activé" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Module proxy_http_module NON activé ou commenté" -ForegroundColor Red
        Write-Host "   💡 Ajoutez: LoadModule proxy_http_module modules/mod_proxy_http.so" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  Fichier httpd.conf non trouvé: $apacheConfPath" -ForegroundColor Red
}

Write-Host ""

# 2. Verifier la configuration du VirtualHost HTTPS
Write-Host "2. Verification du VirtualHost HTTPS..." -ForegroundColor Yellow
if (Test-Path $vhostConfPath) {
    $content = Get-Content $vhostConfPath -Raw
    
    # Vérifier si le VirtualHost 443 existe
    if ($content -match '<VirtualHost.*:443>') {
        Write-Host "   ✅ VirtualHost port 443 trouvé" -ForegroundColor Green
        
        # Extraire la section VirtualHost 443
        $vhost443 = [regex]::Match($content, '<VirtualHost.*:443>.*?</VirtualHost>', [System.Text.RegularExpressions.RegexOptions]::Singleline).Value
        
        if ($vhost443) {
            # Vérifier ProxyPass
            if ($vhost443 -match 'ProxyPass\s+/api/') {
                Write-Host "   ✅ ProxyPass /api/ configuré" -ForegroundColor Green
                
                # Vérifier l'URL de destination
                if ($vhost443 -match 'ProxyPass\s+/api/\s+http://127\.0\.0\.1:3000/api/') {
                    Write-Host "   ✅ URL de destination correcte: http://127.0.0.1:3000/api/" -ForegroundColor Green
                } else {
                    Write-Host "   ⚠️  URL de destination peut être incorrecte" -ForegroundColor Yellow
                }
            } else {
                Write-Host "   ❌ ProxyPass /api/ NON configuré dans VirtualHost 443" -ForegroundColor Red
                Write-Host "   💡 Ajoutez: ProxyPass /api/ http://127.0.0.1:3000/api/" -ForegroundColor Yellow
            }
            
            # Vérifier ProxyPassReverse
            if ($vhost443 -match 'ProxyPassReverse\s+/api/') {
                Write-Host "   ✅ ProxyPassReverse /api/ configuré" -ForegroundColor Green
            } else {
                Write-Host "   ❌ ProxyPassReverse /api/ NON configuré" -ForegroundColor Red
                Write-Host "   💡 Ajoutez: ProxyPassReverse /api/ http://127.0.0.1:3000/api/" -ForegroundColor Yellow
            }
            
            # Vérifier ProxyPreserveHost
            if ($vhost443 -match 'ProxyPreserveHost\s+On') {
                Write-Host "   ✅ ProxyPreserveHost On configuré" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  ProxyPreserveHost peut être manquant" -ForegroundColor Yellow
            }
            
        } else {
            Write-Host "   ⚠️  Impossible d'extraire la section VirtualHost 443" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ❌ VirtualHost port 443 NON trouvé" -ForegroundColor Red
        Write-Host "   💡 Ajoutez un VirtualHost *:443 avec la configuration SSL et le reverse proxy" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  Fichier httpd-vhosts.conf non trouvé: $vhostConfPath" -ForegroundColor Red
}

Write-Host ""

# 3. Verifier que le backend Node.js est accessible
Write-Host "3. Verification du backend Node.js..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend Node.js accessible sur http://localhost:3000" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Backend Node.js répond avec le code: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Backend Node.js NON accessible sur http://localhost:3000" -ForegroundColor Red
    Write-Host "   💡 Vérifiez que le serveur backend est démarré: npm run dev" -ForegroundColor Yellow
}

Write-Host ""

# 4. Test du reverse proxy (si possible)
Write-Host "4. Test du reverse proxy via Apache..." -ForegroundColor Yellow
try {
    # Ignorer les erreurs SSL pour le test local
    $response = Invoke-WebRequest -Uri "https://www.gdri.fr/api/health" -UseBasicParsing -TimeoutSec 5 -SkipCertificateCheck -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Reverse proxy fonctionne !" -ForegroundColor Green
        Write-Host "   ✅ Réponse reçue: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Reverse proxy répond avec le code: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 404) {
        Write-Host "   ❌ Reverse proxy NON configuré ou non fonctionnel (404)" -ForegroundColor Red
        Write-Host "   💡 Le reverse proxy ne redirige pas /api/ vers le backend Node.js" -ForegroundColor Yellow
    } else {
        Write-Host "   ⚠️  Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📋 Résumé des actions à effectuer:" -ForegroundColor Cyan
Write-Host "   1. Vérifier/modifier C:\xampp\apache\conf\httpd.conf (modules proxy)" -ForegroundColor White
Write-Host "   2. Vérifier/modifier C:\xampp\apache\conf\extra\httpd-vhosts.conf (VirtualHost 443)" -ForegroundColor White
Write-Host "   3. Redémarrer Apache depuis le XAMPP Control Panel" -ForegroundColor White
Write-Host "   4. Vérifier que le backend Node.js est démarré sur le port 3000" -ForegroundColor White
Write-Host ""


