# Correction de la configuration ProxyPass

## Problème identifié

Dans votre fichier `httpd-vhosts.conf`, la configuration actuelle est :

```apache
ProxyPass /api http://127.0.0.1:3000/api
ProxyPassReverse /api http://127.0.0.1:3000/api
```

Cette configuration peut causer des problèmes avec les routes qui commencent par `/api/` (avec un slash final).

## Solution recommandée

Modifiez la configuration dans `C:\xampp\apache\conf\extra\httpd-vhosts.conf` :

### Option 1 : Avec slash final (recommandé)

```apache
# Dans le VirtualHost *:443 pour GDRI
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    
    # Proxy pour /api/ GDRI - avec slash final
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
```

### Option 2 : Utiliser LocationMatch (alternative)

Si l'option 1 ne fonctionne pas, utilisez `LocationMatch` :

```apache
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    
    <LocationMatch "^/api/">
        ProxyPass http://127.0.0.1:3000/api/
        ProxyPassReverse http://127.0.0.1:3000/api/
        RequestHeader set X-Forwarded-Proto "https"
    </LocationMatch>
    
    # Proxy pour doc-template API
    ProxyPass /doc-template/api http://127.0.0.1:5005/api
    ProxyPassReverse /doc-template/api http://127.0.0.1:5005/api
</IfModule>
```

## Différence importante

- `ProxyPass /api` (sans slash) : Matche `/api` mais peut avoir des problèmes avec `/api/ugap/...`
- `ProxyPass /api/` (avec slash) : Matche `/api/` et tout ce qui suit, comme `/api/ugap/health`

## Configuration complète du VirtualHost GDRI HTTPS

Voici la section complète à mettre dans `httpd-vhosts.conf` :

```apache
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
    ProxyTimeout 30
    
    # En-têtes de sécurité
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"

    # ⚠️ IMPORTANT : Proxy DOIT être AVANT RewriteEngine
    <IfModule mod_proxy.c>
        ProxyPreserveHost On
        
        # Proxy pour /api/ GDRI - CORRIGÉ avec slash final
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

    # Redirection www obligatoire (APRÈS le proxy)
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/api/ [NC]
    RewriteCond %{REQUEST_URI} !^/doc-template/ [NC]
    RewriteCond %{HTTP_HOST} !^www\.gdr-innovation\.fr$ [NC]
    RewriteRule ^(.*)$ https://www.gdr-innovation.fr$1 [R=301,L]

    <Directory "C:/xampp/htdocs/gdri">
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        <LimitExcept GET POST PUT DELETE OPTIONS HEAD>
            Require all denied
        </LimitExcept>
    </Directory>

    # ... reste de la configuration ...
</VirtualHost>
```

## Étapes de correction

1. **Ouvrir** `C:\xampp\apache\conf\extra\httpd-vhosts.conf`

2. **Trouver** la section `<VirtualHost *:443>` pour GDRI

3. **Remplacer** :
   ```apache
   ProxyPass /api http://127.0.0.1:3000/api
   ProxyPassReverse /api http://127.0.0.1:3000/api
   ```
   
   **Par** :
   ```apache
   ProxyPass /api/ http://127.0.0.1:3000/api/
   ProxyPassReverse /api/ http://127.0.0.1:3000/api/
   ```

4. **Sauvegarder** le fichier

5. **Redémarrer Apache** :
   - XAMPP Control Panel
   - Stop Apache
   - Start Apache

6. **Vérifier** que le backend Node.js est démarré :
   ```powershell
   cd C:\xampp\htdocs\gdri\backend
   node server.js
   ```

7. **Tester** :
   ```powershell
   cd C:\xampp\htdocs\gdri\modules\ugap
   .\test-backend.ps1
   ```

## Vérification

Après correction, testez :

```powershell
# Test direct du backend
Invoke-WebRequest -Uri "http://localhost:3000/api/ugap/health" -UseBasicParsing

# Test via le reverse proxy
Invoke-WebRequest -Uri "https://www.gdr-innovation.fr/api/ugap/health" -UseBasicParsing -SkipCertificateCheck
```

Les deux doivent retourner une réponse JSON avec `"success": true`.
