# Correction du problème de reverse proxy Apache

## Problème identifié
Apache ne peut pas se connecter au backend sur le port 3000, même si le backend écoute bien.

## Solutions à essayer

### 1. Redémarrer Apache
Redémarrez Apache depuis le XAMPP Control Panel pour réinitialiser les connexions proxy.

### 2. Vérifier l'ordre des directives dans le VirtualHost
Dans votre fichier `httpd-vhosts.conf`, assurez-vous que les directives ProxyPass sont bien placées. La configuration actuelle semble correcte :

```apache
<VirtualHost *:443>
    ServerName www.gdr-innovation.fr
    ServerAlias gdr-innovation.fr www.gdri.fr gdri.fr
    DocumentRoot "C:/xampp/htdocs/gdri"

    # SSL Engine
    SSLEngine on
    SSLCertificateFile "C:/xampp/htdocs/gdri/ssl-certs/cert.pem"
    SSLCertificateKeyFile "C:/xampp/htdocs/gdri/ssl-certs/privkey.pem"
    SSLCertificateChainFile "C:/xampp/htdocs/gdri/ssl-certs/chain.pem"

    # Redirection des domaines sans www vers avec www
    RewriteEngine On
    RewriteCond %{HTTP_HOST} !^www\. [NC]
    RewriteRule ^(.*)$ https://www.gdr-innovation.fr$1 [R=301,L]

    <Directory "C:/xampp/htdocs/gdri">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Alias pour doc-template (site indépendant)
    Alias /doc-template "C:/xampp/htdocs/continue/doc_template/front"
    <Directory "C:/xampp/htdocs/continue/doc_template/front">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # ⚠️ IMPORTANT : Reverse Proxy pour le backend Node.js GDR
    # Ces lignes DOIVENT être présentes et dans cet ordre
    ProxyPreserveHost On
    ProxyPass /api/ http://127.0.0.1:3000/api/
    ProxyPassReverse /api/ http://127.0.0.1:3000/api/
    
    # Reverse Proxy pour le backend doc_template (port 5005)
    ProxyPass /doc-template/api http://127.0.0.1:5005/api
    ProxyPassReverse /doc-template/api http://127.0.0.1:5005/api
    
    RequestHeader set X-Forwarded-Proto "https"

    ErrorLog "logs/gdri-ssl-error.log"
    CustomLog "logs/gdri-ssl-access.log" common
</VirtualHost>
```

### 3. Alternative : Utiliser LocationMatch au lieu de ProxyPass direct
Si le problème persiste, essayez cette configuration alternative :

```apache
# Au lieu de :
ProxyPass /api/ http://127.0.0.1:3000/api/
ProxyPassReverse /api/ http://127.0.0.1:3000/api/

# Utilisez :
<LocationMatch "^/api/">
    ProxyPass http://127.0.0.1:3000/api/
    ProxyPassReverse http://127.0.0.1:3000/api/
    ProxyPreserveHost On
</LocationMatch>
```

### 4. Vérifier le firewall Windows
Assurez-vous que le firewall Windows n'bloque pas les connexions locales sur le port 3000.

### 5. Vérifier que les modules proxy sont bien chargés
Dans `httpd.conf`, vérifiez que ces lignes ne sont PAS commentées :
```apache
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
```

## Test après correction
Testez l'API via le proxy :
```
https://www.gdri.fr/api/health
```

Vous devriez recevoir une réponse JSON avec le statut du backend.


