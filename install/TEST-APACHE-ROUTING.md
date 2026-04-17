# Test du routage Apache vers Node.js

## 🔍 Test immédiat

### 1. Test direct Node.js (sans Apache)

Ouvrez dans votre navigateur :
```
http://localhost:3000/api/health
```

**Résultat attendu** : JSON avec `{"status":"ok",...}`

### 2. Test via Apache

Ouvrez dans votre navigateur :
```
https://www.gdr-innovation.fr/api/health
```

**Si cela fonctionne** → Apache route correctement  
**Si vous voyez "Forbidden"** → Apache ne route pas vers Node.js

### 3. Test du callback directement

Ouvrez dans votre navigateur :
```
http://localhost:3000/api/facebook/oauth/callback?code=test&state=test
```

**Résultat attendu** : Redirection vers `/pages/modules/facebook-config.php?error=...` (pas "Forbidden")

### 4. Test du callback via Apache

Ouvrez dans votre navigateur :
```
https://www.gdr-innovation.fr/api/facebook/oauth/callback?code=test&state=test
```

**Si vous voyez "Forbidden"** → Apache ne route pas vers Node.js

## 🔧 Solution si Apache ne route pas

### Vérifier l'ordre dans httpd-vhosts.conf

Dans le VirtualHost GDRI `*:443`, l'ordre DOIT être :

```apache
<VirtualHost *:443>
    # ... SSL config ...
    
    # 1. PROXY EN PREMIER
    <IfModule mod_proxy.c>
        ProxyPreserveHost On
        ProxyPass /api/ http://127.0.0.1:3000/api/
        ProxyPassReverse /api/ http://127.0.0.1:3000/api/
    </IfModule>
    
    # 2. REWRITE APRÈS
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/api/ [NC]
    # ... autres règles ...
    
    # 3. DIRECTORY EN DERNIER
    <Directory "C:/xampp/htdocs/gdri">
        # ...
    </Directory>
</VirtualHost>
```

### Solution alternative : LocationMatch

Si ProxyPass direct ne fonctionne pas, utilisez :

```apache
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    
    <LocationMatch "^/api/">
        ProxyPass http://127.0.0.1:3000/api/
        ProxyPassReverse http://127.0.0.1:3000/api/
        RequestHeader set X-Forwarded-Proto "https"
    </LocationMatch>
</IfModule>
```

## 📋 Checklist

- [ ] `http://localhost:3000/api/health` fonctionne
- [ ] `https://www.gdr-innovation.fr/api/health` fonctionne
- [ ] ProxyPass est AVANT Directory
- [ ] ProxyPass utilise `/api/` avec slash final
- [ ] Apache a été redémarré
