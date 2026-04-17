# Diagnostic du callback OAuth Facebook - "Forbidden"

## Problème
Le callback OAuth `/api/facebook/oauth/callback` retourne "Forbidden" quand Facebook redirige l'utilisateur après l'autorisation.

## Causes possibles

### 1. Rate Limiter (CORRIGÉ ✅)
Le rate limiter global bloquait le callback. **Correction appliquée** : Le callback OAuth est maintenant exclu du rate limiter.

### 2. Configuration Apache
Apache peut bloquer les requêtes sans certains headers ou avec certains patterns.

## Vérifications

### 1. Vérifier que Node.js reçoit la requête

Testez directement Node.js (bypass Apache) :
```powershell
curl -v "http://localhost:3000/api/facebook/oauth/callback?code=test&state=test"
```

**Attendu** : Redirection vers `/pages/modules/facebook-config.php?error=...` (pas de "Forbidden")

### 2. Vérifier la configuration Apache

Ouvrez `C:\xampp\apache\conf\extra\httpd-vhosts.conf` et vérifiez que :

1. **ProxyPass est AVANT RewriteEngine** :
```apache
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    
    # Proxy pour /api/ GDRI
    ProxyPass /api/ http://127.0.0.1:3000/api/
    ProxyPassReverse /api/ http://127.0.0.1:3000/api/
    
    <IfModule mod_headers.c>
        RequestHeader set X-Forwarded-Proto "https"
        RequestHeader set X-Forwarded-For %{REMOTE_ADDR}s
    </IfModule>
</IfModule>

# PUIS RewriteEngine (APRÈS ProxyPass)
RewriteEngine On
RewriteCond %{REQUEST_URI} !^/api/ [NC]
```

2. **Pas de règles Directory qui bloquent /api/** :
```apache
<Directory "C:/xampp/htdocs/gdri">
    Options -Indexes +FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>
```

### 3. Vérifier les logs Apache

Regardez `C:\xampp\apache\logs\error.log` pour voir si Apache bloque la requête :
```powershell
Get-Content "C:\xampp\apache\logs\error.log" -Tail 20
```

### 4. Tester avec curl depuis l'extérieur

```powershell
curl -v "https://www.gdr-innovation.fr/api/facebook/oauth/callback?code=test&state=test"
```

**Attendu** : Redirection 302 vers `/pages/modules/facebook-config.php?error=...`

## Solution

Si le problème persiste après avoir exclu le callback du rate limiter :

1. **Redémarrer Node.js** pour appliquer les changements du rate limiter
2. **Vérifier les logs Node.js** pour voir si la requête arrive
3. **Vérifier la configuration Apache** selon les points ci-dessus

## Test après correction

1. Redémarrer Node.js
2. Tester le callback OAuth depuis Facebook
3. Vérifier les logs Node.js pour confirmer la réception
