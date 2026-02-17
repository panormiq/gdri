# Correction de votre configuration Apache

## ✅ Votre config est BONNE !

Votre configuration **fonctionne déjà** ! Les `LocationMatch` sont correctement placés et les patterns matchent les bonnes routes.

## 🔧 Amélioration optionnelle (pour plus de clarté)

Déplacez les `LocationMatch` **APRÈS** le `ProxyPass /doc-template/api` pour que tous les ProxyPass soient groupés ensemble :

### Dans votre VirtualHost GDRI, remplacez cette section :

```apache
        # Proxy pour /api/ GDRI
        ProxyPass /api/ http://127.0.0.1:3000/api/
        ProxyPassReverse /api/ http://127.0.0.1:3000/api/
        
        # LocationMatch ici (entre les ProxyPass) - FONCTIONNE MAIS...
        <LocationMatch "^/api/ugap/.*/detect-subcategories$">
            ProxyTimeout 600
        </LocationMatch>
        <LocationMatch "^/api/ugap/improve-categorization$">
            ProxyTimeout 600
        </LocationMatch>
        
        # Proxy pour doc-template API
        ProxyPass /doc-template/api ...
```

### Par cette version (plus claire) :

```apache
        # Proxy pour /api/ GDRI
        ProxyPass /api/ http://127.0.0.1:3000/api/
        ProxyPassReverse /api/ http://127.0.0.1:3000/api/
        
        # Proxy pour doc-template API
        ProxyPass /doc-template/api http://127.0.0.1:5005/api
        ProxyPassReverse /doc-template/api http://127.0.0.1:5005/api
        
        # ============================================
        # TIMEOUT DÉDIÉ POUR LES ROUTES IA/SSE
        # (APRÈS tous les ProxyPass)
        # Note: On utilise <Location> avec SetEnv car ProxyTimeout
        # n'est pas autorisé dans <LocationMatch>
        # ============================================
        # Pour détection de sous-catégories
        <LocationMatch "^/api/ugap/categories/[^/]+/detect-subcategories$">
            SetEnv proxy-timeout 600
        </LocationMatch>
        
        # Pour amélioration de catégorisation
        <LocationMatch "^/api/ugap/improve-categorization$">
            SetEnv proxy-timeout 600
        </LocationMatch>
```

## 🔧 Pattern regex amélioré (optionnel)

Le pattern `^/api/ugap/.*/detect-subcategories$` fonctionne, mais `^/api/ugap/categories/[^/]+/detect-subcategories$` est plus précis.

## ✅ Action immédiate

**Votre config actuelle fonctionne !** Redémarrez juste Apache :

```powershell
net stop Apache2.4
net start Apache2.4
```

Puis testez la détection de sous-catégories. Le timeout de 600 secondes devrait être appliqué.
