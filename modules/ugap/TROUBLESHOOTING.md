# Dépannage Module UGAP - Erreur 503

## Problème
L'erreur **503 Service Unavailable** indique que le backend Node.js n'est pas accessible via le reverse proxy Apache.

## Solutions

### 1. Vérifier que le backend Node.js est démarré

Le backend doit être en cours d'exécution sur le port 3000.

**Windows (PowerShell)** :
```powershell
# Vérifier si le processus Node.js tourne
Get-Process node -ErrorAction SilentlyContinue

# Si aucun processus, démarrer le backend
cd C:\xampp\htdocs\gdri\backend
node server.js
```

**Vérification** :
- Le serveur doit afficher : `✅ Serveur backend démarré sur http://0.0.0.0:3000`
- Vous devez voir : `✅ Module UGAP chargé avec succès`

### 2. Vérifier la configuration Apache

#### A. Activer les modules proxy

Ouvrir `C:\xampp\apache\conf\httpd.conf` et vérifier que ces lignes **ne sont PAS commentées** :

```apache
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
```

Si elles sont commentées (avec `#`), décommenter et redémarrer Apache.

#### B. Configurer le VirtualHost HTTPS

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

    # ⚠️ IMPORTANT : Reverse proxy pour les requêtes API
    # Ces lignes DOIVENT être AVANT les directives Directory
    ProxyPreserveHost On
    ProxyPass /api/ http://127.0.0.1:3000/api/
    ProxyPassReverse /api/ http://127.0.0.1:3000/api/
    RequestHeader set X-Forwarded-Proto "https"

    <Directory "C:/xampp/htdocs/gdri">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog "logs/gdri-ssl-error.log"
    CustomLog "logs/gdri-ssl-access.log" common
</VirtualHost>
```

**⚠️ IMPORTANT** : Les directives `ProxyPass` doivent être **AVANT** les directives `<Directory>`.

### 3. Redémarrer Apache

1. Ouvrir le **XAMPP Control Panel**
2. Cliquer sur **Stop** pour Apache
3. Attendre quelques secondes
4. Cliquer sur **Start** pour Apache

### 4. Tests de vérification

#### Test 1 : Vérifier que le backend répond directement

```powershell
# Depuis PowerShell
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing
```

Vous devriez recevoir une réponse JSON avec le statut du backend.

#### Test 2 : Vérifier que le reverse proxy fonctionne

```powershell
# Depuis PowerShell (avec authentification)
$headers = @{
    "Cookie" = "votre-cookie-jwt-si-necessaire"
}
Invoke-WebRequest -Uri "https://www.gdr-innovation.fr/api/health" -Headers $headers -UseBasicParsing
```

#### Test 3 : Vérifier le module UGAP

```powershell
# Tester directement l'endpoint UGAP
Invoke-WebRequest -Uri "http://localhost:3000/api/ugap/health" -UseBasicParsing
```

### 5. Vérifier les logs

#### Logs Apache
Ouvrir `C:\xampp\apache\logs\error.log` et chercher les erreurs liées au proxy.

#### Logs du backend
Vérifier la console où le backend Node.js est démarré pour voir les erreurs éventuelles.

### 6. Vérifier le firewall Windows

Assurez-vous que le firewall Windows n'bloque pas les connexions locales sur le port 3000.

**Windows Defender Firewall** :
1. Ouvrir "Pare-feu Windows Defender"
2. Vérifier les règles de trafic entrant pour le port 3000
3. Si nécessaire, créer une règle pour autoriser le port 3000

### 7. Alternative : Utiliser LocationMatch

Si `ProxyPass` direct ne fonctionne pas, essayez cette configuration alternative :

```apache
# Au lieu de :
ProxyPass /api/ http://127.0.0.1:3000/api/
ProxyPassReverse /api/ http://127.0.0.1:3000/api/

# Utilisez :
<LocationMatch "^/api/">
    ProxyPass http://127.0.0.1:3000/api/
    ProxyPassReverse http://127.0.0.1:3000/api/
    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https"
</LocationMatch>
```

## Checklist rapide

- [ ] Backend Node.js démarré sur le port 3000
- [ ] Module UGAP chargé (visible dans les logs)
- [ ] Modules proxy Apache activés (`mod_proxy.so` et `mod_proxy_http.so`)
- [ ] VirtualHost HTTPS configuré avec `ProxyPass /api/`
- [ ] Apache redémarré après modification
- [ ] Firewall Windows n'bloque pas le port 3000
- [ ] Test direct sur `http://localhost:3000/api/health` fonctionne

## Si le problème persiste

1. Vérifier les logs Apache : `C:\xampp\apache\logs\error.log`
2. Vérifier les logs du backend dans la console
3. Tester avec curl depuis le serveur :
   ```powershell
   curl http://localhost:3000/api/health
   curl https://www.gdr-innovation.fr/api/health
   ```

## Contact

Si le problème persiste après avoir suivi toutes ces étapes, vérifiez :
- La configuration réseau du serveur
- Les permissions des fichiers
- Les variables d'environnement du backend
