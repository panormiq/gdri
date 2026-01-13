# Correction de l'erreur 404 sur /api/analyse/agent-config

## Problème
L'URL `https://www.gdri.fr/api/analyse/agent-config` retourne une erreur 404, alors que le backend Node.js fonctionne correctement.

## Diagnostic

### ✅ Vérifications effectuées
1. **Backend Node.js** : ✅ Démarré et fonctionnel sur `http://localhost:3000`
2. **Module analyse-intention** : ✅ Chargé correctement
3. **Route `/api/analyse`** : ✅ Accessible directement sur le backend

### ❌ Problème identifié
Le reverse proxy Apache n'est **pas configuré correctement** pour le port HTTPS (443).

## Solution

### 1. Vérifier la configuration Apache pour HTTPS

Ouvrir le fichier : `C:\xampp\apache\conf\extra\httpd-vhosts.conf`

Vérifier que le VirtualHost pour le port **443** contient bien la configuration du reverse proxy :

```apache
<VirtualHost *:443>
    ServerName www.gdri.fr
    ServerAlias gdri.fr
    
    # Configuration SSL
    SSLEngine on
    SSLCertificateFile "C:/xampp/htdocs/gdri/ssl-certs/cert.pem"
    SSLCertificateKeyFile "C:/xampp/htdocs/gdri/ssl-certs/privkey.pem"
    SSLCertificateChainFile "C:/xampp/htdocs/gdri/ssl-certs/chain.pem"
    
    DocumentRoot "C:/xampp/htdocs/gdri"
    
    <Directory "C:/xampp/htdocs/gdri">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    # ⚠️ IMPORTANT : Reverse proxy pour les requêtes API vers le backend Node.js
    # Ces lignes DOIVENT être présentes
    ProxyPreserveHost On
    ProxyPass /api/ http://127.0.0.1:3000/api/
    ProxyPassReverse /api/ http://127.0.0.1:3000/api/
    
    # Ou utiliser LocationMatch (alternative)
    # <LocationMatch "^/api/">
    #     ProxyPass http://127.0.0.1:3000/api/
    #     ProxyPassReverse http://127.0.0.1:3000/api/
    #     ProxyPreserveHost On
    # </LocationMatch>
    
    RequestHeader set X-Forwarded-Proto "https"
    
    ErrorLog "logs/gdri-ssl-error.log"
    CustomLog "logs/gdri-ssl-access.log" common
</VirtualHost>
```

### 2. Vérifier que les modules proxy sont activés

Ouvrir le fichier : `C:\xampp\apache\conf\httpd.conf`

Vérifier que ces lignes **ne sont PAS commentées** (pas de `#` devant) :

```apache
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
```

Si elles sont commentées, décommenter et redémarrer Apache.

### 3. Redémarrer Apache

1. Ouvrir le **XAMPP Control Panel**
2. Cliquer sur **Stop** pour Apache
3. Attendre quelques secondes
4. Cliquer sur **Start** pour Apache

### 4. Tester la configuration

#### Test 1 : Vérifier que le backend répond directement
```powershell
# Depuis PowerShell
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing
```

#### Test 2 : Vérifier que le reverse proxy fonctionne
```powershell
# Depuis PowerShell
Invoke-WebRequest -Uri "https://www.gdri.fr/api/health" -UseBasicParsing
```

#### Test 3 : Vérifier la route spécifique
```powershell
# Depuis PowerShell (avec authentification si nécessaire)
Invoke-WebRequest -Uri "https://www.gdri.fr/api/analyse" -UseBasicParsing
```

### 5. Vérifier les logs Apache

Si le problème persiste, consulter les logs :

- **Logs d'erreur** : `C:\xampp\apache\logs\gdri-ssl-error.log`
- **Logs d'accès** : `C:\xampp\apache\logs\gdri-ssl-access.log`

Chercher les erreurs liées au proxy ou aux connexions refusées.

## Configuration alternative (si le problème persiste)

Si `ProxyPass` direct ne fonctionne pas, utiliser `LocationMatch` :

```apache
<VirtualHost *:443>
    # ... autres configurations ...
    
    # Reverse proxy avec LocationMatch
    <LocationMatch "^/api/">
        ProxyPass http://127.0.0.1:3000/api/
        ProxyPassReverse http://127.0.0.1:3000/api/
        ProxyPreserveHost On
        RequestHeader set X-Forwarded-Proto "https"
    </LocationMatch>
</VirtualHost>
```

## Vérification finale

Après avoir appliqué les corrections :

1. Redémarrer Apache
2. Vérifier que le backend Node.js est démarré
3. Tester l'URL : `https://www.gdri.fr/api/analyse/agent-config`

Vous devriez recevoir une réponse JSON (même si c'est une erreur d'authentification, c'est normal - cela signifie que le proxy fonctionne).

## Notes importantes

- Le backend Node.js **doit être démarré** pour que le reverse proxy fonctionne
- Le reverse proxy redirige `/api/*` vers `http://127.0.0.1:3000/api/*`
- Les erreurs 404 indiquent généralement que le reverse proxy n'est pas configuré ou qu'Apache n'a pas été redémarré après modification


