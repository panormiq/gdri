# Correction Apache pour accepter les POST de Facebook

## Problème
Facebook envoie les webhooks en **POST**, mais Apache ne transmet que les **GET** vers Node.js.

## Solution : Vérifier et corriger la configuration Apache

### 1. Vérifier que les modules proxy sont activés

Ouvrir `C:\xampp\apache\conf\httpd.conf` et vérifier que ces lignes **ne sont PAS commentées** :

```apache
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
```

### 2. Configuration VirtualHost HTTPS (port 443)

Ouvrir `C:\xampp\apache\conf\extra\httpd-vhosts.conf` et vérifier que le VirtualHost pour le port 443 contient :

```apache
<VirtualHost *:443>
    ServerName www.gdr-innovation.fr
    ServerAlias gdr-innovation.fr www.gdri.fr gdri.fr
    DocumentRoot "C:/xampp/htdocs/gdri"

    SSLEngine on
    SSLCertificateFile "C:/xampp/htdocs/gdri/ssl-certs/cert.pem"
    SSLCertificateKeyFile "C:/xampp/htdocs/gdri/ssl-certs/privkey.pem"
    SSLCertificateChainFile "C:/xampp/htdocs/gdri/ssl-certs/chain.pem"

    # ⚠️ IMPORTANT : Proxy DOIT être AVANT RewriteEngine
    <IfModule mod_proxy.c>
        ProxyPreserveHost On
        
        # Proxy pour /api/ GDRI (GET et POST)
        ProxyPass /api/ http://127.0.0.1:3000/api/
        ProxyPassReverse /api/ http://127.0.0.1:3000/api/
        
        # ⚠️ IMPORTANT : Autoriser toutes les méthodes HTTP (GET, POST, PUT, DELETE)
        # Cette directive permet de transmettre les POST de Facebook
        ProxyPassReverse /api/ http://127.0.0.1:3000/api/
        
        <IfModule mod_headers.c>
            RequestHeader set X-Forwarded-Proto "https"
            RequestHeader set X-Forwarded-For %{REMOTE_ADDR}s
        </IfModule>
    </IfModule>

    # Redirection www obligatoire (APRÈS le proxy)
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/api/ [NC]
    RewriteCond %{HTTP_HOST} !^www\.gdr-innovation\.fr$ [NC]
    RewriteRule ^(.*)$ https://www.gdr-innovation.fr$1 [R=301,L]

    <Directory "C:/xampp/htdocs/gdri">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### 3. Alternative : Utiliser LocationMatch pour plus de contrôle

Si le problème persiste, utilisez cette configuration alternative qui force l'acceptation des POST :

```apache
<VirtualHost *:443>
    ServerName www.gdr-innovation.fr
    ServerAlias gdr-innovation.fr www.gdri.fr gdri.fr
    DocumentRoot "C:/xampp/htdocs/gdri"

    SSLEngine on
    SSLCertificateFile "C:/xampp/htdocs/gdri/ssl-certs/cert.pem"
    SSLCertificateKeyFile "C:/xampp/htdocs/gdri/ssl-certs/privkey.pem"
    SSLCertificateChainFile "C:/xampp/htdocs/gdri/ssl-certs/chain.pem"

    # ⚠️ IMPORTANT : LocationMatch pour forcer l'acceptation des POST
    <LocationMatch "^/api/">
        ProxyPass http://127.0.0.1:3000/api/
        ProxyPassReverse http://127.0.0.1:3000/api/
        ProxyPreserveHost On
        
        # Autoriser toutes les méthodes HTTP
        <Limit GET POST PUT DELETE OPTIONS>
            Require all granted
        </Limit>
        
        <IfModule mod_headers.c>
            RequestHeader set X-Forwarded-Proto "https"
            RequestHeader set X-Forwarded-For %{REMOTE_ADDR}s
        </IfModule>
    </LocationMatch>

    # Redirection www obligatoire (APRÈS le proxy)
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/api/ [NC]
    RewriteCond %{HTTP_HOST} !^www\.gdr-innovation\.fr$ [NC]
    RewriteRule ^(.*)$ https://www.gdr-innovation.fr$1 [R=301,L]

    <Directory "C:/xampp/htdocs/gdri">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### 4. Vérifier les logs Apache

Après avoir modifié la configuration, vérifiez les logs pour voir si les POST arrivent :

```powershell
# Voir les dernières lignes du log d'accès SSL
Get-Content C:\xampp\apache\logs\gdri-ssl-access.log -Tail 50

# Ou le log général
Get-Content C:\xampp\apache\logs\access.log -Tail 50
```

Cherchez les lignes avec `POST /api/facebook/webhook` pour voir si les requêtes POST arrivent.

### 5. Redémarrer Apache

Après modification, **redémarrer Apache** :

1. Ouvrir le panneau de contrôle XAMPP
2. Cliquer sur "Stop" pour Apache
3. Attendre quelques secondes
4. Cliquer sur "Start" pour Apache

### 6. Tester avec curl

Testez que les POST passent bien :

```powershell
# Test POST vers le webhook
curl.exe -X POST https://www.gdr-innovation.fr/api/facebook/webhook `
  -H "Content-Type: application/json" `
  -d '{"object":"page","entry":[{"id":"test"}]}'
```

Si vous recevez une réponse (même une erreur), c'est que les POST passent.

## Vérification dans les logs Node.js

Vérifiez aussi les logs du serveur Node.js pour voir si les POST arrivent :

```javascript
// Dans backend/server.js, vous devriez voir :
📥 POST /api/facebook/webhook
```

Si vous ne voyez que des GET, le problème vient d'Apache.
