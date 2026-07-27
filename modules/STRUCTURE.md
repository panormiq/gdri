# Structure type d’un module (réutilisable)

Ce document décrit le **modèle à suivre pour la plupart des modules** : backend, front (app utilisateur), backoffice, et organisation des API. Le module **annuaire** est la référence implémentée de l'architecture cible ; toute migration d'un module doit converger vers cette structure.

---

## 1. Les trois facettes d’un module

| Facette | Rôle | Où ça vit |
|--------|------|-----------|
| **Backend** | API, logique métier, accès données | `modules/<nom>/backend/` (routes montées sous `/api/<nom>`) |
| **Front (app user)** | Pages utilisées par les utilisateurs finaux | Page PHP dans `frontend/pages/modules/<nom>.php`, qui charge les assets du module (`modules/<nom>/frontend/assets/css/`, `assets/js/`) |
| **Backoffice** | Config du module par entité, droits, paramètres | Même front principal : `frontend/pages/modules/<nom>-config.php`, `<nom>-llms.php`, etc. |

- **Un seul front** : une seule app (frontend principal) avec une **zone user** (apps) et une **zone backoffice** (admin). Les pages backoffice appellent les routes d’admin du module.
- **Manifest `module.php`** à la racine du module (id, name, description, icon, `view_url`) : référence l'app dans le catalogue du front PHP.

---

## 1bis. Organisation du code backend (architecture cible)

```
modules/<nom>/backend/
├── index.js                       # init() + routes() — rien d'autre
├── routes.js                      # Déclaration des routes, middlewares chaînés
├── package.json                   # name, routes[], enabled, bloc app{} optionnel
├── controllers/                   # 1 fichier par ressource — reçoit req/res, appelle les services
│   └── <ressource>Controller.js
├── services/                      # Logique métier, découpée par domaine
│   └── <domaine>/                 # ex. contacts/, organisations/, integrations/gderpi/
│       ├── <uneFonction>.js       # UNE fonction exportée par fichier (module.exports = fn)
│       └── ...
└── middleware/
    ├── use<Module>EntrepriseDb.js # Multitenant (req.entrepriseDb, req.entrepriseId)
    └── require<Module>Role.js     # Contrôle d'accès par rôles
```

Règles (voir aussi `modules/gderpi/CONVENTIONS.md`) :

- **Une fonction = un fichier** dans `services/` ; nom du fichier = nom de la fonction (`listContacts.js` → `listContacts`). ~50–150 lignes par fichier.
- **En-tête obligatoire** en tête de fichier : `/** FICHIER : modules/<nom>/backend/... */` (+ RÔLE, ENTRÉES/SORTIES si utile).
- Les **contrôleurs** ne contiennent pas de logique métier : ils valident l'entrée, appellent les fonctions de `services/`, formatent la réponse.
- Accès au core GDRI depuis le backend d'un module : `require(path.join(__dirname, '../../../backend/config/jwt'))` (chemins vers la racine du projet).
- Ordre des middlewares sur chaque route : `authenticateJWT` → `use<Module>EntrepriseDb` → `require<Module>Role([...])` → contrôleur.

---

## 2. Organisation des API (backend)

On peut distinguer deux familles de routes (même si aujourd’hui tout est sous `/api/<nom>/`) :

- **Usage « app » (user)** : routes consommées par le front utilisateur (ex. génération, envoi, analyse). Ex. : `POST /api/ia/generate`, `POST /api/analyse/intent`.  
  → À terme possibles sous un préfixe commun type `/api/user/...` pour clarifier.

- **Backoffice** : routes de configuration (CRUD, droits, listes pour les écrans admin). Ex. : `GET/POST /api/ia/llms`, `GET/PUT /api/ia/rights/user/:userId`.  
  → À terme possibles sous `/api/bo/...` (backoffice).

Pour l’instant, les deux coexistent sous `/api/<nom>/`. Lors d’un refactor global, on pourra monter les routes user sous `/api/user/<nom>/` et les routes backoffice sous `/api/bo/<nom>/`.

---

## 3. Scoping par entité (backoffice)

- Les routes backoffice qui dépendent d’une **entité** (entreprise) utilisent l’entité courante du JWT : `req.user.currentEntrepriseId` ou `req.user.entrepriseId`.
- Si l’utilisateur n’a pas d’entité (ex. pas d’entreprise sélectionnée), renvoyer **403** avec un message clair.
- **ADMIN_GDRI** peut agir pour une entité en passant `?entity_id=...` en query sur les routes backoffice.

---

## 4. Contrat backend d’un module

- **`backend/package.json`** : `name`, `displayName`, `version`, `routes` (ex. `["/api/ia"]`), et optionnellement un bloc **`app`** pour le catalogue d’apps (id, label, description, tags, icon, entryPath, configPath).
- **`backend/index.js`** : exporte au minimum `init`, `routes` (getRoutes), et les helpers utiles aux autres modules (ex. `getIAClient`, `getIAClientForEntity`).
- **`backend/routes.js`** : routes Express ; protéger les routes sensibles avec `authenticateJWT` et, pour le backoffice, un middleware « entité requise » si besoin.

---

## 5. Référence : module Annuaire (architecture cible)

- **Manifest** : `modules/annuaire/module.php` (id, name, icon, `view_url` → `pages/modules/annuaire.php`).
- **Backend** : `modules/annuaire/backend/` — routes `/api/annuaire/*` (organisations, services, contacts, members, integrations/gderpi) ;  
  `controllers/` (1 par ressource), `services/<domaine>/<uneFonction>.js`, `middleware/useAnnuaireEntrepriseDb.js` + `requireAnnuaireRole.js`.
- **Front (user)** : `frontend/pages/modules/annuaire.php` charge `modules/annuaire/frontend/assets/css/annuaire.css` et `assets/js/annuaire-app.js`.
- **Données** : collections en base entreprise (`annuaire_organisations`, `annuaire_services`, `annuaire_contacts`), scopées par `entrepriseId`.

Ancienne référence (module **IA**) : backend `modules/ia/backend/`, backoffice `ia-config.php` / `ia-llms.php` / `ia-llm-rights.php`, données en base principale scopées `entity_id`. Le module IA reste valable pour le pattern « backoffice + helpers exportés » (`getIAClientForEntity()`), mais son organisation interne (services monolithiques) n'est plus le modèle à suivre.

En s’inspirant de ce modèle (backend + front + backoffice, scoping entité, un seul front avec deux zones, une fonction par fichier), la plupart des modules peuvent garder la même structure.
