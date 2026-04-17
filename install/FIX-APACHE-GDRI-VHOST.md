# Correction de la configuration Apache pour GDRI - Callback OAuth

## Problème identifié

Le callback OAuth Facebook (`/api/facebook/oauth/callback`) retourne "Forbidden". 

## Configuration actuelle (à corriger)

Dans votre configuration actuelle, vous avez :

```apache
ProxyPass /api/ http://127.0.0.1:3000/api/
ProxyPassReverse /api/ http://127.0.0.1:3000/api/
```

C'est correct, MAIS il y a un problème potentiel avec le `<Directory>` qui peut bloquer les requêtes.

## Solution recommandée

Modifiez la section GDRI HTTPS dans `httpd-vhosts.conf` comme suit :

```apache
# ============================================
# GDRI - HTTPS
# ============================================
<VirtualHost *:443>
    ServerName www.gdr-innovation.fr
    ServerAlias gdr-innovation.fr www.gdri.fr gdri.fr
    DocumentRoot "C:/xampp/htdocs/gdri"

    SSLEngine on
    SSLCertificateFile "C:/Certbot/live/gdr-innovation.fr/fullchain.pem"
    SSLCertificateKeyFile "C:/Certbot/live/gdr-innovation.fr/privkey.pem"
    SSLCertificateChainFile "C:/Certbot/live/gdr-innovation.fr/chain.pem"

    # === PROTECTION DDOS PAR VHOST ===
    TimeOut 20
    ProxyTimeout 600
    
    # En-têtes de sécurité
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"

    # ⚠️ IMPORTANT : Proxy DOIT être AVANT RewriteEngine et Directory
    <IfModule mod_proxy.c>
        ProxyPreserveHost On
        
        # Proxy pour /api/ GDRI - avec slash final (IMPORTANT)
        ProxyPass /api/ http://127.0.0.1:3000/api/
        ProxyPassReverse /api/ http://127.0.0.1:3000/api/
       
        # Proxy pour doc-template API
        ProxyPass /doc-template/api http://127.0.0.1:5005/api
        ProxyPassReverse /doc-template/api http://127.0.0.1:5005/api
        
        <IfModule mod_headers.c>
            RequestHeader set X-Forwarded-Proto "https"
            RequestHeader set X-Forwarded-For %{REMOTE_ADDR}s
        </IfModule>
    </IfModule>

    # ⚠️ IMPORTANT : Exclure /api/ du Directory pour éviter les conflits
    # Redirection www obligatoire (APRÈS le proxy pour éviter les conflits)
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/api/ [NC]
    RewriteCond %{REQUEST_URI} !^/doc-template/ [NC]
    RewriteCond %{HTTP_HOST} !^www\.gdr-innovation\.fr$ [NC]
    RewriteRule ^(.*)$ https://www.gdr-innovation.fr$1 [R=301,L]

    # Configuration Directory (APRÈS le proxy)
    # ⚠️ IMPORTANT : Les requêtes /api/ sont déjà proxyées, donc ce Directory ne s'applique pas à elles
    <Directory "C:/xampp/htdocs/gdri">
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Autoriser les méthodes nécessaires pour l'API (GET, POST, PUT, DELETE, OPTIONS pour CORS)
        <LimitExcept GET POST PUT DELETE OPTIONS HEAD>
            Require all denied
        </LimitExcept>
    </Directory>

    Alias /doc-template "C:/xampp/htdocs/continue/doc_template/front"
    <Directory "C:/xampp/htdocs/continue/doc_template/front">
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        <IfModule mod_headers.c>
            RequestHeader set X-Forwarded-Proto "https" env=HTTPS
        </IfModule>
        
        <LimitExcept GET POST PUT DELETE OPTIONS HEAD>
            Require all denied
        </LimitExcept>
    </Directory>

    Alias /modules "C:/xampp/htdocs/gdri/modules"
    <Directory "C:/xampp/htdocs/gdri/modules">
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        <LimitExcept GET POST PUT DELETE OPTIONS HEAD>
            Require all denied
        </LimitExcept>
    </Directory>

    ErrorLog "logs/gdri-ssl-error.log"
    CustomLog "logs/gdri-ssl-access.log" combined
</VirtualHost>
```

## Points clés

1. **ProxyPass avec slash final** : `/api/` (pas `/api`)
2. **ProxyPass AVANT Directory** : C'est déjà le cas dans votre config, c'est bon
3. **RewriteCond exclut /api/** : C'est déjà le cas, c'est bon

## Vérifications supplémentaires

### 1. Vérifier que mod_proxy est activé

Dans `httpd.conf`, vérifiez que ces lignes ne sont PAS commentées :

```apache
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
```

### 2. Tester le proxy

Testez si le proxy fonctionne :

```powershell
# Test direct Node.js
curl http://localhost:3000/api/health

# Test via Apache
curl https://www.gdr-innovation.fr/api/health
```

### 3. Vérifier les logs

Regardez les logs Apache après avoir testé le callback :

```
C:\xampp\apache\logs\gdri-ssl-error.log
C:\xampp\apache\logs\gdri-ssl-access.log
```

Cherchez les lignes avec `/api/facebook/oauth/callback`.

## Solution alternative (si le problème persiste)

Si le problème persiste, essayez d'utiliser `LocationMatch` au lieu de `ProxyPass` direct :

```apache
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    
    <LocationMatch "^/api/">
        ProxyPass http://127.0.0.1:3000/api/
        ProxyPassReverse http://127.0.0.1:3000/api/
        RequestHeader set X-Forwarded-Proto "https"
        RequestHeader set X-Forwarded-For %{REMOTE_ADDR}s
    </LocationMatch>
    
    # Proxy pour doc-template API
    ProxyPass /doc-template/api http://127.0.0.1:5005/api
    ProxyPassReverse /doc-template/api http://127.0.0.1:5005/api
</IfModule>
```

## Après modification

1. **Redémarrez Apache** (via XAMPP Control Panel)
2. **Vérifiez les logs** pour voir s'il y a des erreurs
3. **Testez le callback OAuth** à nouveau
