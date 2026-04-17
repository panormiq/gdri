# Diagnostic - Erreur "Forbidden" sur le callback OAuth

## 🔍 Vérifications rapides

### 1. Vérifier que Node.js écoute sur le port 3000

```powershell
netstat -ano | findstr :3000
```

Vous devriez voir quelque chose comme :
```
TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       12345
```

Si rien n'apparaît, **démarrez le serveur Node.js** :
```powershell
cd C:\xampp\htdocs\gdri\backend
node server.js
```

### 2. Tester directement Node.js (sans Apache)

Ouvrez un navigateur et allez sur :
```
http://localhost:3000/api/health
```

Si cela fonctionne, Node.js est OK. Si cela ne fonctionne pas, le problème vient de Node.js.

### 3. Tester via Apache

Ouvrez un navigateur et allez sur :
```
https://www.gdr-innovation.fr/api/health
```

Si cela fonctionne, Apache route correctement. Si cela ne fonctionne pas, le problème vient d'Apache.

### 4. Vérifier la configuration Apache

Ouvrez le fichier :
```
C:\xampp\apache\conf\extra\httpd-vhosts.conf
```

Cherchez le VirtualHost pour `www.gdr-innovation.fr` sur le port 443.

**Vérifiez que vous avez :**

```apache
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    
    # ⚠️ IMPORTANT : avec slash final
    ProxyPass /api/ http://127.0.0.1:3000/api/
    ProxyPassReverse /api/ http://127.0.0.1:3000/api/
    
    <IfModule mod_headers.c>
        RequestHeader set X-Forwarded-Proto "https"
        RequestHeader set X-Forwarded-For %{REMOTE_ADDR}s
    </IfModule>
</IfModule>
```

**⚠️ IMPORTANT :**
- Les directives `ProxyPass` doivent être **AVANT** les directives `<Directory>`
- Utilisez `/api/` avec un slash final (pas `/api`)

### 5. Vérifier que mod_proxy est activé

Ouvrez :
```
C:\xampp\apache\conf\httpd.conf
```

Cherchez ces lignes et vérifiez qu'elles ne sont **PAS** commentées (pas de `#` devant) :

```apache
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
```

### 6. Redémarrer Apache

Après toute modification :
1. Arrêtez Apache dans XAMPP Control Panel
2. Redémarrez Apache
3. Vérifiez les logs pour des erreurs

## 🔧 Solution rapide

Si le problème persiste, utilisez cette configuration dans `httpd-vhosts.conf` :

```apache
<VirtualHost *:443>
    ServerName www.gdr-innovation.fr
    ServerAlias gdr-innovation.fr
    DocumentRoot "C:/xampp/htdocs/gdri"

    SSLEngine on
    SSLCertificateFile "C:/xampp/htdocs/gdri/ssl-certs/cert.pem"
    SSLCertificateKeyFile "C:/xampp/htdocs/gdri/ssl-certs/privkey.pem"
    SSLCertificateChainFile "C:/xampp/htdocs/gdri/ssl-certs/chain.pem"

    # ⚠️ PROXY AVANT TOUT LE RESTE
    <IfModule mod_proxy.c>
        ProxyPreserveHost On
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

    # Directory (APRÈS le proxy)
    <Directory "C:/xampp/htdocs/gdri">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

## 📋 Checklist

- [ ] Node.js est démarré et écoute sur le port 3000
- [ ] `http://localhost:3000/api/health` fonctionne
- [ ] `https://www.gdr-innovation.fr/api/health` fonctionne
- [ ] `ProxyPass /api/` est configuré dans Apache
- [ ] `ProxyPass` est AVANT `<Directory>`
- [ ] `mod_proxy` et `mod_proxy_http` sont activés
- [ ] Apache a été redémarré après les modifications

## 🐛 Si le problème persiste

1. **Vérifiez les logs Apache** :
   - `C:\xampp\apache\logs\error.log`
   - `C:\xampp\apache\logs\access.log`

2. **Vérifiez les logs Node.js** dans la console du serveur

3. **Testez avec curl** :
   ```powershell
   curl https://www.gdr-innovation.fr/api/health
   ```
