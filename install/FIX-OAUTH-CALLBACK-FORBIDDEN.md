# Correction de l'erreur "Forbidden" sur le callback OAuth Facebook

## Problème

Après avoir autorisé l'application Facebook, vous êtes redirigé vers :
```
https://www.gdr-innovation.fr/api/facebook/oauth/callback?code=...&state=...
```

Et vous obtenez l'erreur :
```
Forbidden
You don't have permission to access this resource.
```

## Causes possibles

1. **Apache ne route pas correctement `/api/` vers Node.js**
2. **Le serveur Node.js n'est pas démarré ou ne répond pas**
3. **Problème de permissions dans la configuration Apache**

## Solutions

### 1. Vérifier que le serveur Node.js est démarré

```bash
# Vérifier si le serveur écoute sur le port 3000
netstat -ano | findstr :3000
```

Si rien n'apparaît, démarrez le serveur :
```bash
cd backend
node server.js
```

### 2. Vérifier la configuration Apache

Ouvrez le fichier de configuration Apache :
```
C:\xampp\apache\conf\extra\httpd-vhosts.conf
```

Vérifiez que dans le VirtualHost `*:443` pour `www.gdr-innovation.fr`, vous avez :

```apache
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    
    # Proxy pour /api/ GDRI - IMPORTANT : avec slash final
    ProxyPass /api/ http://127.0.0.1:3000/api/
    ProxyPassReverse /api/ http://127.0.0.1:3000/api/
    
    <IfModule mod_headers.c>
        RequestHeader set X-Forwarded-Proto "https"
        RequestHeader set X-Forwarded-For %{REMOTE_ADDR}s
    </IfModule>
</IfModule>
```

**⚠️ IMPORTANT :** Les directives `ProxyPass` doivent être **AVANT** les directives `<Directory>`.

### 3. Vérifier que mod_proxy est activé

Dans `C:\xampp\apache\conf\httpd.conf`, vérifiez que ces lignes ne sont pas commentées :

```apache
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
```

### 4. Tester directement le callback

Testez si le callback fonctionne directement sur Node.js :

```bash
# Dans un terminal
curl http://localhost:3000/api/facebook/oauth/callback?code=test&state=test
```

Si cela fonctionne, le problème vient d'Apache. Si cela ne fonctionne pas, le problème vient de Node.js.

### 5. Vérifier les logs Apache

Regardez les logs Apache pour voir ce qui se passe :
```
C:\xampp\apache\logs\error.log
C:\xampp\apache\logs\access.log
```

Cherchez les lignes avec `/api/facebook/oauth/callback`.

### 6. Vérifier les logs Node.js

Dans la console du serveur Node.js, vous devriez voir des logs quand le callback est appelé. Si vous ne voyez rien, Apache ne route pas la requête.

## Configuration complète recommandée

Dans `httpd-vhosts.conf`, pour le VirtualHost `*:443` :

```apache
<VirtualHost *:443>
    ServerName www.gdr-innovation.fr
    ServerAlias gdr-innovation.fr
    DocumentRoot "C:/xampp/htdocs/gdri"

    SSLEngine on
    SSLCertificateFile "C:/xampp/htdocs/gdri/ssl-certs/cert.pem"
    SSLCertificateKeyFile "C:/xampp/htdocs/gdri/ssl-certs/privkey.pem"
    SSLCertificateChainFile "C:/xampp/htdocs/gdri/ssl-certs/chain.pem"

    # ⚠️ IMPORTANT : Proxy DOIT être AVANT Directory
    <IfModule mod_proxy.c>
        ProxyPreserveHost On
        
        # Proxy pour toutes les routes /api/
        ProxyPass /api/ http://127.0.0.1:3000/api/
        ProxyPassReverse /api/ http://127.0.0.1:3000/api/
        
        <IfModule mod_headers.c>
            RequestHeader set X-Forwarded-Proto "https"
            RequestHeader set X-Forwarded-For %{REMOTE_ADDR}s
        </IfModule>
    </IfModule>

    # Redirections (APRÈS le proxy)
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/api/ [NC]
    RewriteCond %{HTTP_HOST} !^www\.gdr-innovation\.fr$ [NC]
    RewriteRule ^(.*)$ https://www.gdr-innovation.fr$1 [R=301,L]

    # Configuration du répertoire (APRÈS le proxy)
    <Directory "C:/xampp/htdocs/gdri">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

## Après modification

1. **Redémarrez Apache** (via XAMPP Control Panel)
2. **Vérifiez les logs** pour voir s'il y a des erreurs
3. **Testez à nouveau** la connexion OAuth

## Test rapide

Testez si Apache route correctement vers Node.js :

```bash
# Depuis votre navigateur ou curl
curl https://www.gdr-innovation.fr/api/health
```

Si cela fonctionne, Apache route correctement. Si cela ne fonctionne pas, vérifiez la configuration Apache.
