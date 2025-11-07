# Guide de vérification du Reverse Proxy Apache

## Problème
Les requêtes vers `/api/*` depuis `https://www.gdri.fr` retournent une erreur 503 Service Unavailable.

## Vérifications à effectuer

### 1. Vérifier que les modules proxy sont activés

Ouvrir `C:\xampp\apache\conf\httpd.conf` et vérifier que ces lignes ne sont pas commentées :

```apache
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
```

Si elles sont commentées (avec `#`), décommenter et redémarrer Apache.

### 2. Vérifier la configuration du VirtualHost HTTPS

Ouvrir `C:\xampp\apache\conf\extra\httpd-vhosts.conf` et vérifier que le VirtualHost pour le port 443 contient :

```apache
<VirtualHost *:443>
    ServerName www.gdri.fr
    ServerAlias gdri.fr
    DocumentRoot "C:/xampp/htdocs/gdri"
    
    # Configuration SSL (à adapter selon votre certificat)
    SSLEngine on
    SSLCertificateFile "C:/xampp/apache/conf/ssl.crt/server.crt"
    SSLCertificateKeyFile "C:/xampp/apache/conf/ssl.key/server.key"
    
    <Directory "C:/xampp/htdocs/gdri">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    # ⚠️ IMPORTANT : Reverse proxy pour les requêtes API
    <LocationMatch "^/api/">
        ProxyPass http://127.0.0.1:3000/api/
        ProxyPassReverse http://127.0.0.1:3000/api/
        ProxyPreserveHost On
    </LocationMatch>
    
    # Logs
    ErrorLog "C:/xampp/apache/logs/gdri-ssl-error.log"
    CustomLog "C:/xampp/apache/logs/gdri-ssl-access.log" common
</VirtualHost>
```

### 3. Vérifier que le backend Node.js écoute bien

Le backend doit démarrer avec :
```
✅ Serveur backend démarré sur http://0.0.0.0:3000
```

Si vous voyez `http://localhost:3000` ou `http://127.0.0.1:3000`, c'est correct aussi.

### 4. Tester le reverse proxy

Depuis le serveur, tester directement :

```powershell
# Test depuis le serveur
Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/health" -UseBasicParsing
```

Si ça fonctionne, tester via Apache :

```powershell
# Test via Apache (en localhost)
Invoke-WebRequest -Uri "http://localhost/api/health" -UseBasicParsing

# Test via Apache (en HTTPS si configuré)
Invoke-WebRequest -Uri "https://www.gdri.fr/api/health" -UseBasicParsing
```

### 5. Vérifier les logs Apache

En cas d'erreur, consulter :
- `C:\xampp\apache\logs\error.log`
- `C:\xampp\apache\logs\gdri-ssl-error.log`

Chercher des erreurs liées à `proxy`, `ProxyPass`, ou `Connection refused`.

## Solution rapide

Si le VirtualHost HTTPS n'existe pas ou n'a pas le reverse proxy :

1. Copier la configuration depuis `install/apache-vhost.conf`
2. L'adapter à votre configuration SSL
3. Redémarrer Apache

## Commandes utiles

```powershell
# Vérifier si Apache écoute sur le port 443
netstat -an | findstr :443

# Vérifier si le backend écoute sur le port 3000
netstat -an | findstr :3000

# Redémarrer Apache (depuis XAMPP Control Panel)
# Ou via PowerShell (en administrateur)
Restart-Service Apache2.4
```

