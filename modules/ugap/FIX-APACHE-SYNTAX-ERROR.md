# Fix erreur Apache : ProxyTimeout not allowed in LocationMatch

## ❌ Erreur
```
AH00526: Syntax error on line 181 of C:/xampp/apache/conf/extra/httpd-vhosts.conf:
ProxyTimeout not allowed in <LocationMatch> context
```

## ✅ Solution

`ProxyTimeout` n'est **pas autorisé** dans `<LocationMatch>`. Il faut utiliser une autre approche.

### Option 1 : Utiliser SetEnv (recommandé)

Remplacez vos `<LocationMatch>` par :

```apache
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    
    # Proxy pour /api/ GDRI
    ProxyPass /api/ http://127.0.0.1:3000/api/
    ProxyPassReverse /api/ http://127.0.0.1:3000/api/
    
    # Proxy pour doc-template API
    ProxyPass /doc-template/api http://127.0.0.1:5005/api
    ProxyPassReverse /doc-template/api http://127.0.0.1:5005/api
    
    # ============================================
    # TIMEOUT DÉDIÉ POUR LES ROUTES IA/SSE
    # ============================================
    # Utiliser SetEnv pour définir le timeout
    <LocationMatch "^/api/ugap/categories/[^/]+/detect-subcategories$">
        SetEnv proxy-timeout 600
    </LocationMatch>
    
    <LocationMatch "^/api/ugap/improve-categorization$">
        SetEnv proxy-timeout 600
    </LocationMatch>
    
    <IfModule mod_headers.c>
        RequestHeader set X-Forwarded-Proto "https"
        RequestHeader set X-Forwarded-For %{REMOTE_ADDR}s
    </IfModule>
</IfModule>
```

### Option 2 : Augmenter le timeout global (plus simple)

Si SetEnv ne fonctionne pas, augmentez simplement le timeout global :

```apache
# === PROTECTION DDOS PAR VHOST ===
TimeOut 20
ProxyTimeout 600  # 10 minutes pour toutes les routes (y compris IA)
```

**Note** : Cette option augmente le timeout pour TOUTES les routes, pas seulement l'IA.

### Option 3 : Utiliser ProxyPass avec timeout dans l'URL (avancé)

```apache
# Proxy spécifique pour les routes IA avec timeout
ProxyPass /api/ugap/categories/ http://127.0.0.1:3000/api/ugap/categories/ timeout=600
ProxyPass /api/ugap/improve-categorization http://127.0.0.1:3000/api/ugap/improve-categorization timeout=600

# Puis le proxy général
ProxyPass /api/ http://127.0.0.1:3000/api/
```

## 🚀 Solution rapide (recommandée)

**Pour que ça fonctionne IMMÉDIATEMENT**, utilisez l'Option 2 : augmentez simplement `ProxyTimeout` à 600 dans votre VirtualHost.

C'est la solution la plus simple et la plus fiable.
