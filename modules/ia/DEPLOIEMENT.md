# Déploiement du module IA en production

Pour que la page **Configuration IA** (`/frontend/pages/modules/ia-config.php`) et les appels à `/api/ia/config`, `/api/ia/providers`, etc. fonctionnent en production, le **dossier du module doit être présent** sur le serveur et le **backend Node.js doit être redémarré**.

## À déployer

- Copier tout le dossier **`modules/ia`** (y compris `backend/`, `backend/data/`, `backend/services/`, etc.) à la **racine du projet**, au même niveau que `backend/` et `frontend/`.

Structure attendue sur le serveur :

```
votre_racine/
  backend/
  frontend/
  modules/
    ia/
      backend/
        index.js
        routes.js
        package.json
        data/
        services/
```

## Vérifications

1. **Présence du dossier**  
   Depuis la racine du projet :  
   `ls modules/ia/backend/package.json` (ou équivalent sous Windows) doit afficher le fichier.

2. **Démarrage du backend Node**  
   Le backend charge les modules au démarrage. Au lancement, les logs doivent contenir par exemple :  
   - `Module découvert : Serveur IA`  
   - `Route chargée : /api/ia`

3. **Si le module n’est pas chargé**  
   Les requêtes vers `/api/ia/*` renvoient **503** avec un message indiquant que le module IA n’est pas disponible. Dans ce cas, vérifier que `modules/ia` est bien déployé et redémarrer le processus Node (PM2, systemd, etc.).

## Proxy Apache / Nginx

Vérifier que les requêtes vers `/api/*` sont bien proxyfiées vers le backend Node (port 3000 ou celui configuré). Le module n’ajoute pas de règle spécifique : tout ce qui est sous `/api/ia` est géré par le backend Node lorsque le module est chargé.
