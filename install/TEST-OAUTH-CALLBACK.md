# Test du Callback OAuth Facebook

## 🔍 Diagnostic rapide

### 1. Vérifier que Node.js est démarré

```powershell
netstat -ano | findstr :3000
```

**Si rien n'apparaît**, démarrez le serveur Node.js :
```powershell
cd C:\xampp\htdocs\gdri\backend
node server.js
```

### 2. Tester directement Node.js (sans Apache)

Ouvrez dans votre navigateur :
```
http://localhost:3000/api/health
```

**Si cela fonctionne** → Node.js est OK  
**Si cela ne fonctionne pas** → Le problème vient de Node.js

### 3. Tester le callback directement sur Node.js

Ouvrez dans votre navigateur :
```
http://localhost:3000/api/facebook/oauth/callback?code=test&state=test
```

Vous devriez voir une redirection ou un message d'erreur (pas "Forbidden"). Si vous voyez "Forbidden", le problème vient de Node.js.

### 4. Tester via Apache

Ouvrez dans votre navigateur :
```
https://www.gdr-innovation.fr/api/health
```

**Si cela fonctionne** → Apache route correctement  
**Si cela ne fonctionne pas** → Le problème vient d'Apache

### 5. Tester le callback via Apache

Ouvrez dans votre navigateur :
```
https://www.gdr-innovation.fr/api/facebook/oauth/callback?code=test&state=test
```

**Si vous voyez "Forbidden"** → Apache ne route pas vers Node.js

## 🔧 Solutions

### Solution 1 : Vérifier la configuration Apache

Dans `C:\xampp\apache\conf\extra\httpd-vhosts.conf`, pour le VirtualHost GDRI `*:443`, assurez-vous que :

1. **ProxyPass est AVANT Directory** :
```apache
# ⚠️ PROXY AVANT TOUT
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    ProxyPass /api/ http://127.0.0.1:3000/api/
    ProxyPassReverse /api/ http://127.0.0.1:3000/api/
</IfModule>

# Directory APRÈS
<Directory "C:/xampp/htdocs/gdri">
    ...
</Directory>
```

2. **RewriteCond exclut /api/** :
```apache
RewriteEngine On
RewriteCond %{REQUEST_URI} !^/api/ [NC]  # ⬅️ IMPORTANT
RewriteCond %{HTTP_HOST} !^www\.gdr-innovation\.fr$ [NC]
RewriteRule ^(.*)$ https://www.gdr-innovation.fr$1 [R=301,L]
```

### Solution 2 : Utiliser LocationMatch (alternative)

Si ProxyPass direct ne fonctionne pas, utilisez LocationMatch :

```apache
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    
    <LocationMatch "^/api/">
        ProxyPass http://127.0.0.1:3000/api/
        ProxyPassReverse http://127.0.0.1:3000/api/
        RequestHeader set X-Forwarded-Proto "https"
        RequestHeader set X-Forwarded-For %{REMOTE_ADDR}s
    </LocationMatch>
</IfModule>
```

### Solution 3 : Vérifier les logs

Regardez les logs Apache :
```
C:\xampp\apache\logs\gdri-ssl-error.log
C:\xampp\apache\logs\gdri-ssl-access.log
```

Cherchez les lignes avec `/api/facebook/oauth/callback`.

## 📋 Checklist

- [ ] Node.js est démarré (port 3000)
- [ ] `http://localhost:3000/api/health` fonctionne
- [ ] `http://localhost:3000/api/facebook/oauth/callback?code=test&state=test` fonctionne
- [ ] `https://www.gdr-innovation.fr/api/health` fonctionne
- [ ] `ProxyPass /api/` est configuré dans Apache
- [ ] `ProxyPass` est AVANT `<Directory>`
- [ ] `RewriteCond` exclut `/api/`
- [ ] Apache a été redémarré

## 🐛 Si le problème persiste

1. **Vérifiez les logs Node.js** dans la console du serveur
2. **Vérifiez les logs Apache** pour voir les erreurs
3. **Testez avec curl** :
   ```powershell
   curl https://www.gdr-innovation.fr/api/health
   ```
