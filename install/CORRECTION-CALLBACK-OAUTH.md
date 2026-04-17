# Correction du callback OAuth Facebook - Erreur "Forbidden"

## ✅ Diagnostic

Node.js est **démarré** et écoute sur le port 3000. Le problème vient donc d'**Apache** qui ne route pas correctement la requête.

## 🔧 Solution

### Étape 1 : Vérifier la configuration Apache

Ouvrez le fichier :
```
C:\xampp\apache\conf\extra\httpd-vhosts.conf
```

### Étape 2 : Vérifier l'ordre des directives

Dans le VirtualHost GDRI `*:443`, l'ordre DOIT être :

1. **ProxyPass** (en premier)
2. **RewriteEngine** (après ProxyPass)
3. **Directory** (en dernier)

### Étape 3 : Configuration correcte

Assurez-vous que votre VirtualHost GDRI ressemble à ceci :

```apache
<VirtualHost *:443>
    ServerName www.gdr-innovation.fr
    ServerAlias gdr-innovation.fr www.gdri.fr gdri.fr
    DocumentRoot "C:/xampp/htdocs/gdri"

    SSLEngine on
    SSLCertificateFile "C:/Certbot/live/gdr-innovation.fr/fullchain.pem"
    SSLCertificateKeyFile "C:/Certbot/live/gdr-innovation.fr/privkey.pem"
    SSLCertificateChainFile "C:/Certbot/live/gdr-innovation.fr/chain.pem"

    TimeOut 20
    ProxyTimeout 600
    
    # En-têtes de sécurité
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"

    # ⚠️ ÉTAPE 1 : PROXY EN PREMIER (AVANT TOUT)
    <IfModule mod_proxy.c>
        ProxyPreserveHost On
        
        # Proxy pour /api/ - avec slash final
        ProxyPass /api/ http://127.0.0.1:3000/api/
        ProxyPassReverse /api/ http://127.0.0.1:3000/api/
       
        # Proxy pour doc-template API
        ProxyPass /doc-template/api http://127.0.0.1:5005/api
        ProxyPassReverse /doc-template/api http://127.0.0.1:5005/api
        
        <IfModule mod_headers.c>
            RequestHeader set X-Forwarded-Proto "https"
            RequestHeader set X-Forwarded-For %{REMOTE_ADDR}s
        </IfModule>
    </IfModule>

    # ⚠️ ÉTAPE 2 : REWRITE APRÈS PROXY (et exclure /api/)
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/api/ [NC]
    RewriteCond %{REQUEST_URI} !^/doc-template/ [NC]
    RewriteCond %{HTTP_HOST} !^www\.gdr-innovation\.fr$ [NC]
    RewriteRule ^(.*)$ https://www.gdr-innovation.fr$1 [R=301,L]

    # ⚠️ ÉTAPE 3 : DIRECTORY EN DERNIER
    <Directory "C:/xampp/htdocs/gdri">
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        <LimitExcept GET POST PUT DELETE OPTIONS HEAD>
            Require all denied
        </LimitExcept>
    </Directory>

    # ... reste de la config ...
</VirtualHost>
```

## 🔍 Points critiques

1. **ProxyPass AVANT Directory** : C'est le plus important
2. **RewriteCond exclut /api/** : Pour ne pas interférer avec le proxy
3. **Slash final dans ProxyPass** : `/api/` (pas `/api`)

## 🧪 Test après modification

1. **Redémarrez Apache** (via XAMPP Control Panel)
2. **Testez** : `https://www.gdr-innovation.fr/api/health`
3. **Testez le callback** : `https://www.gdr-innovation.fr/api/facebook/oauth/callback?code=test&state=test`

## 🐛 Si ça ne fonctionne toujours pas

### Solution alternative : Utiliser LocationMatch

Remplacez le bloc ProxyPass par :

```apache
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    
    <LocationMatch "^/api/">
        ProxyPass http://127.0.0.1:3000/api/
        ProxyPassReverse http://127.0.0.1:3000/api/
        RequestHeader set X-Forwarded-Proto "https"
        RequestHeader set X-Forwarded-For %{REMOTE_ADDR}s
    </LocationMatch>
    
    ProxyPass /doc-template/api http://127.0.0.1:5005/api
    ProxyPassReverse /doc-template/api http://127.0.0.1:5005/api
</IfModule>
```

## 📋 Vérifications finales

- [ ] ProxyPass est AVANT Directory
- [ ] RewriteCond exclut `/api/`
- [ ] ProxyPass utilise `/api/` avec slash final
- [ ] Apache a été redémarré
- [ ] `https://www.gdr-innovation.fr/api/health` fonctionne
