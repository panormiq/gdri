# Test du callback OAuth via Apache

## Test 1 : Node.js direct (✅ FONCTIONNE)
```powershell
curl -v "http://localhost:3000/api/facebook/oauth/callback?code=test&state=test"
```
**Résultat attendu** : Redirection 302 vers `/pages/modules/facebook-config.php?error=invalid_state`

## Test 2 : Via Apache (à tester)
```powershell
curl -v "https://www.gdr-innovation.fr/api/facebook/oauth/callback?code=test&state=test"
```
**Résultat attendu** : Même redirection 302 (pas de "Forbidden")

## Si Test 2 retourne "Forbidden"

### Vérifier les logs Apache
```powershell
Get-Content "C:\xampp\apache\logs\error.log" -Tail 30
```

### Vérifier la configuration Apache
Ouvrir `C:\xampp\apache\conf\extra\httpd-vhosts.conf` et vérifier :

1. **ProxyPass est AVANT RewriteEngine** :
```apache
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    ProxyPass /api/ http://127.0.0.1:3000/api/
    ProxyPassReverse /api/ http://127.0.0.1:3000/api/
</IfModule>

# PUIS RewriteEngine
RewriteEngine On
RewriteCond %{REQUEST_URI} !^/api/ [NC]
```

2. **Pas de règles Directory qui bloquent /api/** :
```apache
<Directory "C:/xampp/htdocs/gdri">
    Require all granted
</Directory>
```

### Redémarrer Apache après modification
```powershell
# Arrêter Apache
net stop Apache2.4

# Démarrer Apache
net start Apache2.4
```

## Correction appliquée dans Node.js

Le callback OAuth est maintenant exclu du rate limiter dans `backend/middleware/rate-limiter.js` :

```javascript
skip: (req) => {
    // Ne pas limiter les callbacks OAuth (appelés directement par Facebook)
    if (req.path && req.path.includes('/facebook/oauth/callback')) {
      return true;
    }
    // ...
}
```

**⚠️ IMPORTANT** : Redémarrer Node.js pour appliquer cette modification.
