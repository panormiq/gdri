# Structure des modules (dossier `modules/`)

Ce document décrit la structure et les conventions des modules hébergés à la racine du dossier `modules/`.  
Ces modules sont découverts et chargés par le backend via `backend/core/module-registry.js` et `backend/core/module-loader.js`.

**Structure type réutilisable** (backend, front, backoffice, scoping entité) : voir **`modules/STRUCTURE.md`**. Le module **annuaire** est la référence de l'architecture cible (une fonction par fichier, controllers/services/middleware, frontend en assets).

---

## 1. Convention d’arborescence

Chaque module est un dossier à la racine de `modules/` avec au minimum un **backend** et optionnellement un **frontend**. Le modèle cible (celui appliqué lors des migrations, ex. **annuaire**) est :

```
modules/
├── MODULE.md                    # Ce fichier
├── <nom-module>/
│   ├── module.php               # Manifest PHP (id, name, icon, view_url) — pour le catalogue d'apps du front
│   ├── backend/                 # Obligatoire : API et logique métier
│   │   ├── index.js             # Point d'entrée (init, getRoutes)
│   │   ├── routes.js            # Routes Express (montées sous /api/<nom>)
│   │   ├── package.json         # name, displayName, routes[], enabled, bloc app{} optionnel
│   │   ├── controllers/         # 1 contrôleur par ressource (req/res uniquement)
│   │   │   └── <ressource>Controller.js
│   │   ├── services/            # Logique métier — 1 sous-dossier par domaine, 1 fonction par fichier
│   │   │   └── <domaine>/
│   │   │       ├── <uneFonction>.js   # ex. listContacts.js exporte listContacts
│   │   │       └── ...
│   │   └── middleware/
│   │       ├── use<Module>EntrepriseDb.js   # Multitenant
│   │       └── require<Module>Role.js       # Contrôle d'accès
│   └── frontend/                # Assets du module (chargés par la page PHP du front principal)
│       └── assets/
│           ├── css/<module>.css
│           └── js/<module>-app.js
```

- **Backend** : doit contenir `backend/package.json` et `backend/index.js`.  
  Les routes déclarées dans `package.json` (`routes`) sont montées sur l’app Express (ex. `/api/analyse`, `/api/mail`).
- **Une fonction = un fichier** dans `services/` : chaque fonction exportée vit dans son propre fichier, nommé comme la fonction (`listContacts.js` → `listContacts`), avec un en-tête `/** FICHIER : ... */`. Voir `modules/gderpi/CONVENTIONS.md` pour le détail de la convention.
- **Frontend** : la **page PHP** vit dans le front principal (`frontend/pages/modules/<nom>.php`) et charge les assets du module depuis `modules/<nom>/frontend/assets/` (CSS + JS). Les pages de config backoffice restent aussi dans `frontend/pages/modules/` (ex. `<nom>-config.php`).
- **`module.php`** (racine du module) : manifest lu par le front PHP pour référencer l'app (id, nom, icône, `view_url` vers la page du front principal).
- Les modules plus anciens (ia, mail, workflow…) ne suivent pas encore tous ce modèle ; toute **migration** d'un module doit le ramener vers cette structure.

---

## 2. Découverte des modules (backend)

- **Emplacement** : `module-registry.js` scanne le dossier `modules/` (chemin dit « externe »).
- **Règle** : pour chaque sous-dossier `modules/<nom>/`, le registre cherche :
  - `modules/<nom>/backend/` (répertoire)
  - `modules/<nom>/backend/package.json` (fichier)
- Si les deux existent, le module est enregistré avec :
  - `name` = nom du dossier (ex. `analyse-intention`, `mail`)
  - `path` = chemin vers `modules/<nom>/backend/`
  - `routes` = tableau lu depuis `package.json` (ex. `["/api/analyse"]`)

Les modules dans `backend/modules/` (core) sont toujours découverts en premier ; les modules sous `modules/` (externe) sont chargés ensuite, sans écraser un module déjà enregistré.

---

## 3. Point d’entrée backend (`backend/index.js`)

Le chargeur charge `backend/index.js` et attend :

- **`init(app, db)`** (async, optionnel) : initialisation (index MongoDB, etc.).
- **`routes`** : fonction qui retourne un routeur Express (souvent `() => require('./routes')`).
- **`config`** (optionnel) : objet de configuration du module.

Exemple minimal :

```js
const routes = require('./routes');
const config = require('./config.json');

async function init(app, db) {
  console.log('  🎯 Initialisation module...');
  // index, etc.
}

function getRoutes() {
  return routes;
}

module.exports = { init, routes: getRoutes, config };
```

---

## 4. Dépendances entre modules

Un module peut utiliser un autre module situé sous `modules/` :

- **Depuis un autre module** (ex. `modules/facebook/backend/`) :  
  `require(path.join(__dirname, '../../analyse-intention/backend/services/AIService'))`
- **Depuis le backend core** (ex. `backend/modules/facebook/`) :  
  `require(path.join(__dirname, '../../../../modules/analyse-intention/backend/services/AIService'))`

Éviter les chemins relatifs vers l’ancien emplacement `backend/modules/<nom>/` pour les modules déjà déplacés dans `modules/<nom>/backend/`.

---

## 5. Liste des modules sous `modules/`

| Module              | Dossier               | Routes API       | Description courte                    |
|---------------------|------------------------|------------------|--------------------------------------|
| **Serveur IA**      | `ia/`                  | `/api/ia`        | Client IA (backendIA puis Ollama)     |
| Agent Analyse d’intention | `analyse-intention/` | `/api/analyse`   | Détection d’intentions (utilise `ia`) |
| **Annuaire**        | `annuaire/`            | `/api/annuaire`  | Organisations, services, contacts (réf. architecture) |
| Banque              | `banque/`              | `/api/banque`    | Relevé PDF → CSV (import Oxygène)     |
| Chat IA             | `chat/`                | `/api/chat`      | Chat (utilise `ia`)                  |
| Data-Backup         | `data-backup/`         | `/api/backup`    | Export / restauration MongoDB par entité |
| **Doc-Hub**         | `doc-hub/`             | `/api/doc-hub`   | GED par projet, diffusion par liens   |
| **GDERPI**          | `gderpi/`              | `/api/gderpi`    | Mini ERP (boutiques, tiers, devis, commandes) |
| Service Mail        | `mail/`                | `/api/mail`      | Envoi / réception d’emails           |
| Media Studio        | `media-studio/`        | `/api/media-studio` | Images / vidéos IA (ComfyUI)      |
| PM                  | `pm/`                  | `/api/pm`        | Gestion de projet (inbox, Kanban)     |
| Prompt              | `prompt/`              | `/api/prompt`    | Service partagé d’envoi de prompts IA |
| UGAP                | `ugap/`                | `/api/ugap`      | Configurateur bateaux (devis, fiche) |
| Workflow Builder    | `workflow/`            | `/api/workflow`  | Gestion des workflows                |

(`card/` existe mais n’a pas encore de `backend/package.json` — non chargé par le registre.)

**Architecture IA** : voir `modules/ARCHITECTURE-IA-INTENTION.md` (module `ia` = point d’accès unique ; priorité backendIA, fallback Ollama).

- **Configuration IA (service & modèles)** : `frontend/pages/modules/ia-config.php` — choix du fournisseur (Ollama, OpenAI, Claude, DeepSeek), du modèle et saisie des clés API.
- **Configuration agent « Analyse d’intention »** : `frontend/pages/modules/analyse-intention-config.php`.

---

## 6. Fichier `MODULE.md` à la racine de `modules/`

Ce fichier (`modules/MODULE.md`) sert de référence pour :

- la structure commune (backend / frontend) ;
- la découverte et le chargement des modules ;
- les chemins à utiliser pour les dépendances entre modules ;
- la liste des modules et leurs routes.

En cas de nouveau module ou de déplacement (ex. depuis `backend/modules/` vers `modules/`), mettre à jour ce fichier et les références croisées (WebhookService, UgapAIService, ChatService, etc.) pour pointer vers `modules/<nom>/backend/`.

---

## 7. Chargement à chaud et redémarrage admin

Sans redémarrer le backend Node.js, un **admin GDRI** peut :

- **Découvrir et charger les nouveaux modules** : après avoir installé un dossier dans `modules/<nom>/backend/` (avec `package.json` et `index.js`), appeler **POST /api/admin/modules/reload** (JWT + rôle ADMIN_GDRI). Le serveur re-scanne `modules/` et charge uniquement les modules pas encore chargés. Réponse : `{ success, newlyLoaded: ['ia', …] }`.
- **Voir l’état des modules** : **GET /api/admin/modules/status** (JWT + ADMIN_GDRI) renvoie la liste des modules avec `loaded` / `enabled` et leurs routes.

Pour **redémarrer le processus** (utile si un module a été mis à jour en place) : **POST /api/admin/restart** (JWT + ADMIN_GDRI). Par défaut cette route renvoie 403 ; pour l’activer, définir **ALLOW_ADMIN_RESTART=true** dans l’environnement du backend. Le processus fait alors un arrêt propre ; un gestionnaire (PM2, systemd, etc.) peut le relancer automatiquement.
