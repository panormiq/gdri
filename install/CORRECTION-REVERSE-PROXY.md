# Correction de l'erreur 404 sur les routes API (Reverse Proxy Apache)

## Problème
Les routes `/api/analyse/agent-config` et `/api/mail/config/mail` retournent une erreur 404 via Apache HTTPS, alors que le backend Node.js fonctionne correctement.

**Erreur observée :**
```
404 Not Found
The requested URL was not found on this server.
Apache/2.4.58 (Win64) OpenSSL/3.1.3 PHP/8.2.12 Server at www.gdri.fr Port 443
```

## Diagnostic

### ✅ Vérifications à faire

1. **Backend Node.js accessible directement ?**
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing
   ```
   - Si ça fonctionne : le backend est OK ✅
   - Si erreur : démarrer le backend avec `npm run dev`

2. **Reverse proxy via Apache ?**
   ```powershell
   Invoke-WebRequest -Uri "https://www.gdri.fr/api/health" -UseBasicParsing -SkipCertificateCheck
   ```
   - Si 404 : le reverse proxy n'est pas configuré ❌
   - Si ça fonctionne : le reverse proxy fonctionne ✅

## Solution : Configuration du Reverse Proxy Apache

### Étape 1 : Activer les modules proxy dans Apache

**Fichier :** `C:\xampp\apache\conf\httpd.conf`

**Rechercher ces lignes :**
```apache
#LoadModule proxy_module modules/mod_proxy.so
#LoadModule proxy_http_module modules/mod_proxy_http.so
```

**Les décommenter (enlever le `#`) :**
```apache
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
```

### Étape 2 : Configurer le VirtualHost HTTPS (port 443)

**Fichier :** `C:\xampp\apache\conf\extra\httpd-vhosts.conf`

**Vérifier/créer le VirtualHost pour le port 443 :**

```apache
<VirtualHost *:443>
    ServerName www.gdri.fr
    ServerAlias gdri.fr
    
    # Configuration SSL (si SSL est configuré)
    SSLEngine on
    SSLCertificateFile "C:/xampp/htdocs/gdri/ssl-certs/cert.pem"
    SSLCertificateKeyFile "C:/xampp/htdocs/gdri/ssl-certs/privkey.pem"
    SSLCertificateChainFile "C:/xampp/htdocs/gdri/ssl-certs/chain.pem"
    
    DocumentRoot "C:/xampp/htdocs/gdri"
    
    # ⚠️ IMPORTANT : Reverse proxy DOIT être AVANT les directives <Directory>
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
    
    # Logs
    ErrorLog "logs/gdri-ssl-error.log"
    CustomLog "logs/gdri-ssl-access.log" common
</VirtualHost>
```

**⚠️ ATTENTION : L'ordre est important !**
- Les directives `ProxyPass` DOIVENT être **AVANT** la directive `<Directory>`
- Sinon Apache servira les fichiers statiques au lieu de faire le reverse proxy

### Étape 3 : Alternative avec LocationMatch (si nécessaire)

Si `ProxyPass` direct ne fonctionne pas, utilisez `LocationMatch` :

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
    
    # Reverse proxy avec LocationMatch
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

### Étape 4 : Redémarrer Apache

1. Ouvrir **XAMPP Control Panel**
2. Cliquer sur **Stop** pour Apache
3. Attendre 2-3 secondes
4. Cliquer sur **Start** pour Apache
5. Vérifier qu'il n'y a pas d'erreur de démarrage

### Étape 5 : Vérifier que le backend Node.js est démarré

Le backend Node.js **DOIT** être démarré sur le port 3000 :

```powershell
# Depuis la racine du projet
cd C:\xampp\htdocs\gdri
npm run dev
```

Ou depuis backend/ :

```powershell
cd C:\xampp\htdocs\gdri\backend
npm run dev
```

## Tests après configuration

### Test 1 : Backend directement accessible
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing
```
**Résultat attendu :** StatusCode 200 avec un JSON

### Test 2 : Reverse proxy via Apache HTTPS
```powershell
Invoke-WebRequest -Uri "https://www.gdri.fr/api/health" -UseBasicParsing -SkipCertificateCheck
```
**Résultat attendu :** StatusCode 200 avec le même JSON

### Test 3 : Route spécifique
```powershell
Invoke-WebRequest -Uri "https://www.gdri.fr/api/analyse" -UseBasicParsing -SkipCertificateCheck
```
**Résultat attendu :** StatusCode 200 (même si erreur d'authentification, c'est normal - le proxy fonctionne)

## Vérification des logs Apache

Si le problème persiste, consulter les logs :

**Fichiers de logs :**
- Erreurs : `C:\xampp\apache\logs\gdri-ssl-error.log`
- Accès : `C:\xampp\apache\logs\gdri-ssl-access.log`

**Chercher :**
- Erreurs "Connection refused" → Backend Node.js non démarré
- Erreurs "proxy: error" → Problème de configuration proxy
- Erreurs "AH01102: error reading status line" → Backend ne répond pas

## Points importants

1. ✅ Le backend Node.js **DOIT** être démarré avant de tester le reverse proxy
2. ✅ Les modules proxy **DOIVENT** être activés dans `httpd.conf`
3. ✅ Les directives `ProxyPass` **DOIVENT** être **AVANT** `<Directory>` dans le VirtualHost
4. ✅ Apache **DOIT** être redémarré après modification de la configuration

## Si le problème persiste

1. Vérifier que le VirtualHost 443 est bien chargé (pas commenté dans `httpd-vhosts.conf`)
2. Vérifier que le fichier `httpd-vhosts.conf` est bien inclus dans `httpd.conf` :
   ```apache
   Include conf/extra/httpd-vhosts.conf
   ```
3. Vérifier les logs d'erreur Apache pour plus de détails
4. Tester avec `curl` depuis un autre terminal pour isoler le problème

## Résumé des fichiers à modifier

1. **`C:\xampp\apache\conf\httpd.conf`** : Activer modules proxy
2. **`C:\xampp\apache\conf\extra\httpd-vhosts.conf`** : Configurer VirtualHost 443 avec reverse proxy
3. Redémarrer Apache


