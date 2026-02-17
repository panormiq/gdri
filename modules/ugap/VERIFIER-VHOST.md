# Vérification de la configuration VirtualHost Apache

## Étape 1 : Vérifier le fichier httpd-vhosts.conf

Ouvrez le fichier : `C:\xampp\apache\conf\extra\httpd-vhosts.conf`

## Étape 2 : Vérifier la configuration HTTPS

Le VirtualHost pour le port 443 doit contenir les directives `ProxyPass` **AVANT** les directives `<Directory>`.

### Configuration correcte :

```apache
<VirtualHost *:443>
    ServerName www.gdr-innovation.fr
    ServerAlias gdr-innovation.fr www.gdri.fr gdri.fr
    DocumentRoot "C:/xampp/htdocs/gdri"

    # Configuration SSL
    SSLEngine on
    SSLCertificateFile "C:/xampp/htdocs/gdri/ssl-certs/cert.pem"
    SSLCertificateKeyFile "C:/xampp/htdocs/gdri/ssl-certs/privkey.pem"
    SSLCertificateChainFile "C:/xampp/htdocs/gdri/ssl-certs/chain.pem"

    # ⚠️ IMPORTANT : Reverse proxy pour les requêtes API
    # Ces lignes DOIVENT être AVANT les directives Directory
    ProxyPreserveHost On
    ProxyPass /api/ http://127.0.0.1:3000/api/
    ProxyPassReverse /api/ http://127.0.0.1:3000/api/
    RequestHeader set X-Forwarded-Proto "https"

    # Configuration du répertoire (APRÈS les directives ProxyPass)
    <Directory "C:/xampp/htdocs/gdri">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog "logs/gdri-ssl-error.log"
    CustomLog "logs/gdri-ssl-access.log" common
</VirtualHost>
```

## Étape 3 : Points importants

1. **Ordre des directives** : `ProxyPass` doit être **AVANT** `<Directory>`
2. **ProxyPreserveHost On** : Conserve l'en-tête Host
3. **RequestHeader set X-Forwarded-Proto "https"** : Indique au backend que la requête vient de HTTPS
4. **URL du backend** : `http://127.0.0.1:3000/api/` (pas `https://`)

## Étape 4 : Redémarrer Apache

Après modification, redémarrer Apache :
1. XAMPP Control Panel
2. Stop Apache
3. Start Apache

## Étape 5 : Tester

```powershell
# Test direct du backend
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing

# Test via le reverse proxy
Invoke-WebRequest -Uri "https://www.gdr-innovation.fr/api/health" -UseBasicParsing -SkipCertificateCheck
```

## Si ça ne fonctionne pas

### Alternative : Utiliser LocationMatch

Si `ProxyPass` direct ne fonctionne pas, essayez :

```apache
<VirtualHost *:443>
    ServerName www.gdr-innovation.fr
    ServerAlias gdr-innovation.fr www.gdri.fr gdri.fr
    DocumentRoot "C:/xampp/htdocs/gdri"

    SSLEngine on
    SSLCertificateFile "C:/xampp/htdocs/gdri/ssl-certs/cert.pem"
    SSLCertificateKeyFile "C:/xampp/htdocs/gdri/ssl-certs/privkey.pem"
    SSLCertificateChainFile "C:/xampp/htdocs/gdri/ssl-certs/chain.pem"

    # Alternative avec LocationMatch
    <LocationMatch "^/api/">
        ProxyPass http://127.0.0.1:3000/api/
        ProxyPassReverse http://127.0.0.1:3000/api/
        ProxyPreserveHost On
        RequestHeader set X-Forwarded-Proto "https"
    </LocationMatch>

    <Directory "C:/xampp/htdocs/gdri">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog "logs/gdri-ssl-error.log"
    CustomLog "logs/gdri-ssl-access.log" common
</VirtualHost>
```

## Vérifier les logs

Si ça ne fonctionne toujours pas, vérifiez les logs :

1. **Logs Apache** : `C:\xampp\apache\logs\error.log`
2. **Logs SSL** : `C:\xampp\apache\logs\gdri-ssl-error.log`

Cherchez les erreurs liées à :
- `proxy:`
- `ProxyPass`
- `Connection refused`
