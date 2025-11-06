# 🧪 Guide de Test Frontend

## Comment tester le frontend avant mise en production

### 1. Tests visuels (à faire manuellement)

#### Page d'accueil
```
URL: http://localhost/gdri/frontend/index.php
✅ Vérifier:
- Le CSS se charge (page stylée, pas brut)
- Le logo s'affiche
- La navigation fonctionne
- Les boutons sont cliquables
- Pas d'erreurs dans la console (F12)
```

#### Pages principales
```
✅ Dashboard: http://localhost/gdri/frontend/pages/dashboard.php
✅ Modules: http://localhost/gdri/frontend/pages/modules.php
✅ Agents: http://localhost/gdri/frontend/pages/agents.php
✅ Contact: http://localhost/gdri/frontend/pages/contact.php

Pour chaque page:
- Le CSS se charge
- Les liens fonctionnent
- Les images s'affichent
- Pas d'erreurs 404 dans la console
```

#### Pages de configuration
```
✅ Mail config: http://localhost/gdri/frontend/pages/modules/mail-config.php
✅ Analyse intention: http://localhost/gdri/frontend/pages/modules/analyse-intention-config.php

Vérifier:
- Les formulaires s'affichent
- Les champs sont remplissables
- Les boutons fonctionnent
```

### 2. Tests de console navigateur

#### Ouvrir la console (F12)
```
1. Onglet "Console"
   - Vérifier qu'il n'y a PAS d'erreurs en rouge
   - Les warnings jaunes sont généralement OK

2. Onglet "Network" (Réseau)
   - Recharger la page (F5)
   - Vérifier que tous les fichiers CSS/JS se chargent (status 200)
   - Pas de 404 (fichiers non trouvés)
   - Pas de 500 (erreurs serveur)
```

### 3. Test des URLs générées

#### Utiliser le script de test
```
URL: http://localhost/gdri/frontend/test-urls.php

Vérifier:
- BASE_URL est correct (devrait être /gdri/frontend/)
- Les URLs CSS sont correctes (/gdri/frontend/assets/css/main.css)
- Les URLs JS sont correctes (/gdri/frontend/assets/js/main.js)
```

### 4. Checklist rapide

- [ ] Page d'accueil s'affiche correctement
- [ ] Navigation fonctionne
- [ ] CSS chargé (page stylée)
- [ ] JavaScript chargé (pas d'erreurs console)
- [ ] Images chargées (logo visible)
- [ ] Formulaires fonctionnent
- [ ] Modales s'ouvrent/ferment
- [ ] Liens internes fonctionnent
- [ ] Pas d'erreurs 404 dans Network
- [ ] Pas d'erreurs dans la console

### 5. Test en production (simulation)

Pour vérifier que ça fonctionnera en production:
```
1. Vérifier que BASE_URL sera /frontend/ en production
   (voir test-urls.php avec un hostname de prod)

2. Vérifier les chemins relatifs
   - Tous les assets doivent être accessibles via /frontend/assets/
```

## 🚨 Erreurs courantes à vérifier

### Erreur: "Failed to load resource"
- **Cause**: URL incorrecte pour un fichier CSS/JS
- **Solution**: Vérifier BASE_URL dans test-urls.php

### Erreur: "MIME type incorrect"
- **Cause**: Fichier CSS/JS renvoie du HTML (404)
- **Solution**: Vérifier que le fichier existe et que l'URL est correcte

### Erreur: "Cannot GET /..."
- **Cause**: Route backend non accessible
- **Solution**: Vérifier que le backend Node.js est démarré

## 📝 Script de test automatique

Utilisez `test-frontend.ps1` pour un test rapide.

