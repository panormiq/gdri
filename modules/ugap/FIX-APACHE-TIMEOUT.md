# Fix Apache Timeout pour SSE - Timeout dédié pour l'IA

## Problème
Apache ferme la connexion SSE après 30 secondes à cause de `ProxyTimeout 30` global.

## Solution : Timeout dédié pour les routes IA

Ajouter dans votre VirtualHost Apache (`C:\xampp\apache\conf\extra\httpd-vhosts.conf`) :

```apache
<VirtualHost *:443>
    ServerName www.gdr-innovation.fr
    ServerAlias gdr-innovation.fr www.gdri.fr gdri.fr
    DocumentRoot "C:/xampp/htdocs/gdri"

    SSLEngine on
    SSLCertificateFile "C:/Certbot/live/gdr-innovation.fr/fullchain.pem"
    SSLCertificateKeyFile "C:/Certbot/live/gdr-innovation.fr/privkey.pem"
    SSLCertificateChainFile "C:/Certbot/live/gdr-innovation.fr/chain.pem"

    # === PROTECTION DDOS PAR VHOST ===
    TimeOut 20
    ProxyTimeout 30  # Timeout global (reste à 30s pour les autres routes)
    
    # En-têtes de sécurité
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"

    # ⚠️ IMPORTANT : Proxy DOIT être AVANT RewriteEngine
    <IfModule mod_proxy.c>
        ProxyPreserveHost On
        
        # ============================================
        # PROXY GÉNÉRAL (pour toutes les routes /api/)
        # ============================================
        # Proxy pour /api/ GDRI - avec slash final
        ProxyPass /api/ http://127.0.0.1:3000/api/
        ProxyPassReverse /api/ http://127.0.0.1:3000/api/
        
        # Proxy pour doc-template API
        ProxyPass /doc-template/api http://127.0.0.1:5005/api
        ProxyPassReverse /doc-template/api http://127.0.0.1:5005/api
        
        # ============================================
        # TIMEOUT DÉDIÉ POUR LES ROUTES IA/SSE
        # (APRÈS ProxyPass pour surcharger le timeout)
        # ============================================
        # Routes SSE pour détection de sous-catégories (UGAP)
        # Timeout de 10 minutes (600 secondes) uniquement pour ces routes
        <LocationMatch "^/api/ugap/.*/detect-subcategories$">
            ProxyTimeout 600
        </LocationMatch>
        
        # Routes SSE pour amélioration de catégorisation (UGAP)
        <LocationMatch "^/api/ugap/improve-categorization$">
            ProxyTimeout 600
        </LocationMatch>
        
        <IfModule mod_headers.c>
            RequestHeader set X-Forwarded-Proto "https"
            RequestHeader set X-Forwarded-For %{REMOTE_ADDR}s
        </IfModule>
    </IfModule>

    # Redirection www obligatoire (APRÈS le proxy)
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/api/ [NC]
    RewriteCond %{REQUEST_URI} !^/doc-template/ [NC]
    RewriteCond %{HTTP_HOST} !^www\.gdr-innovation\.fr$ [NC]
    RewriteRule ^(.*)$ https://www.gdr-innovation.fr$1 [R=301,L]

    <Directory "C:/xampp/htdocs/gdri">
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        <LimitExcept GET POST PUT DELETE OPTIONS HEAD>
            Require all denied
        </LimitExcept>
    </Directory>
</VirtualHost>
```

## Points importants

1. **LocationMatch APRÈS ProxyPass général** : Les LocationMatch doivent être APRÈS le ProxyPass pour surcharger le timeout
2. **ProxyTimeout 600** : 10 minutes uniquement pour les routes IA (les autres routes gardent 30s)
3. **Ordre des directives** : ProxyPass général → LocationMatch (timeout spécifique) → RewriteEngine

## Étapes de configuration

1. **Ouvrir** `C:\xampp\apache\conf\extra\httpd-vhosts.conf`
2. **Trouver** votre VirtualHost `*:443` pour GDRI
3. **Ajouter** les sections `<LocationMatch>` AVANT le `<ProxyPass /api/` général
4. **Sauvegarder** le fichier
5. **Redémarrer Apache** :
   ```powershell
   # Via XAMPP Control Panel ou :
   net stop Apache2.4
   net start Apache2.4
   ```

## Vérification

Après redémarrage, testez une détection de sous-catégories. La connexion ne devrait plus se fermer après 30 secondes.

## Alternative : Contourner Apache pour les tests

Pour tester sans modifier Apache, accédez directement au backend Node.js :
- Backend Node.js : `http://localhost:3000/api/ugap/...`
- Au lieu de : `https://www.gdr-innovation.fr/api/ugap/...`
