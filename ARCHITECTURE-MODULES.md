# Architecture des Modules GDRI

## Vue d'ensemble

L'architecture GDRI est conçue pour permettre l'intégration de modules backend et frontend de manière modulaire et extensible. Tous les modules passent par le **serveur GDRI central** qui gère l'authentification, le multitenant et le routage.

## Architecture générale

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (PHP/JS)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Module A   │  │   Module B   │  │   Module C   │      │
│  │  (Frontend)  │  │  (Frontend)  │  │  (Frontend)  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼─────────────────┼─────────────────┼──────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
          ┌─────────────────▼─────────────────┐
          │     Serveur GDRI (Node.js)        │
          │  ┌─────────────────────────────┐  │
          │  │  Authentification JWT        │  │
          │  │  (authenticateJWT)           │  │
          │  └──────────────┬──────────────┘  │
          │  ┌──────────────▼──────────────┐  │
          │  │  Sélection Base Multitenant │  │
          │  │  (useEntrepriseDb)              │  │
          │  └──────────────┬──────────────┘  │
          │  ┌──────────────▼──────────────┐  │
          │  │  Contrôle d'accès (rôles)    │  │
          │  │  (requireRole)               │  │
          │  └──────────────┬──────────────┘  │
          │  ┌──────────────▼──────────────┐  │
          │  │  Routage vers modules       │  │
          │  │  (module-loader)            │  │
          │  └──────────────┬──────────────┘  │
          └─────────────────┼─────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
    ┌─────▼─────┐    ┌──────▼──────┐   ┌─────▼─────┐
    │  Module A │    │  Module B   │   │  Module C │
    │ (Backend) │    │ (Backend)   │   │ (Backend) │
    └─────┬─────┘    └──────┬──────┘   └─────┬─────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
          ┌─────────────────▼─────────────────┐
          │     Bases de données MongoDB      │
          │  ┌─────────────────────────────┐  │
          │  │  Base principale (GDRI)     │  │
          │  │  - users                    │  │
          │  │  - entities                 │  │
          │  │  - services                 │  │
          │  └─────────────────────────────┘  │
          │  ┌─────────────────────────────┐  │
          │  │  Base Entreprise 1           │  │
          │  │  (GDR-ENTREPRISE-{id1})     │  │
          │  └─────────────────────────────┘  │
          │  ┌─────────────────────────────┐  │
          │  │  Base Entreprise 2           │  │
          │  │  (GDR-ENTREPRISE-{id2})     │  │
          │  └─────────────────────────────┘  │
          └─────────────────────────────────────┘
```

## Flux de traitement d'une requête

1. **Frontend** → Envoie une requête vers `/api/{module}/...`
2. **Serveur GDRI** → Reçoit la requête et applique les middlewares dans l'ordre :
   - **Rate limiting** : Protection contre DDoS
   - **Authentification JWT** : Vérification du token (cookie HttpOnly ou header Authorization)
   - **Sélection base multitenant** : Connexion à la base de données de l'entreprise
   - **Contrôle d'accès** : Vérification des rôles et permissions
3. **Module** → Traite la requête avec accès à la base de données de l'entreprise
4. **Réponse** → Retour au frontend

## Authentification

### Système JWT

L'authentification est gérée par le serveur GDRI via des **tokens JWT** stockés dans des **cookies HttpOnly** (sécurité XSS) ou transmis via le header `Authorization: Bearer {token}`.

**Fichier** : `backend/config/jwt.js`

**Middleware** : `authenticateJWT`

```javascript
const { authenticateJWT } = require('../config/jwt');

// Utilisation dans une route
router.get('/ma-route', authenticateJWT, (req, res) => {
  // req.user contient les informations de l'utilisateur
  const userId = req.user.user_id;
  const entrepriseId = req.user.currentEntrepriseId;
  const role = req.user.role;
});
```

**Données disponibles dans `req.user`** :
- `user_id` : ID de l'utilisateur
- `currentEntrepriseId` : ID de l'entreprise active
- `entrepriseId` : Alias de `currentEntrepriseId` (compatibilité)
- `role` : Rôle de l'utilisateur (`ADMIN_GDRI`, `ADMIN_ENTITY`, `USER_ENTITY`)
- `email` : Email de l'utilisateur

### Rôles utilisateurs

| Rôle | Description | Accès |
|------|-------------|-------|
| `ADMIN_GDRI` | Administrateur système | Accès complet à toutes les entreprises et modules |
| `ADMIN_ENTITY` | Administrateur d'entreprise | Accès complet à son entreprise uniquement |
| `USER_ENTITY` | Utilisateur standard | Accès limité (lecture) à son entreprise |

## Multitenant - Bases de données par entreprise

### Architecture multitenant

Chaque entreprise possède sa propre base de données MongoDB isolée :
- **Nom de la base** : `GDR-ENTREPRISE-{entrepriseId}`
- **Utilisateur MongoDB** : `entreprise_{entrepriseId}`
- **Création automatique** : Lors de la création d'une entreprise via `EntrepriseDatabaseService`

**Fichier** : `backend/services/EntrepriseDatabaseService.js`

### Middleware multitenant

Chaque module doit utiliser un middleware pour attacher la base de données de l'entreprise courante.

**Exemple** : `modules/workflow/backend/middleware/useWorkflowEntrepriseDb.js`

```javascript
const useWorkflowEntrepriseDb = async (req, res, next) => {
  const user = req.user;
  const entrepriseId = user.currentEntrepriseId || user.entrepriseId;
  
  // Connexion à la base de l'entreprise
  req.entrepriseDb = await database.getEntrepriseDb(entrepriseId);
  req.entrepriseId = entrepriseId;
  
  next();
};
```

**Utilisation** :
```javascript
router.get('/workflows', 
  authenticateJWT,           // 1. Authentification
  useWorkflowEntrepriseDb,   // 2. Base multitenant
  requireWorkflowRole(['USER_ENTITY', 'ADMIN_ENTITY']), // 3. Contrôle d'accès
  workflowController.list    // 4. Handler
);
```

## Contrôle d'accès - Routes admin

### Middleware de contrôle d'accès

Pour protéger les routes admin, utilisez un middleware de contrôle de rôle.

**Exemple** : `modules/workflow/backend/middleware/requireWorkflowRole.js`

```javascript
function requireWorkflowRole(roles = []) {
  // ADMIN_GDRI et superadmin ont toujours accès
  const allowed = new Set([...(roles || []), 'ADMIN_GDRI', 'superadmin']);

  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Non authentifié' 
      });
    }

    if (!allowed.has(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé pour ce module'
      });
    }

    next();
  };
}
```

### Utilisation dans les routes

**Routes publiques (lecture)** :
```javascript
router.get('/workflows',
  authenticateJWT,
  useWorkflowEntrepriseDb,
  requireWorkflowRole(['USER_ENTITY', 'ADMIN_ENTITY']), // USER peut lire
  workflowController.list
);
```

**Routes admin (écriture)** :
```javascript
router.post('/workflows',
  authenticateJWT,
  useWorkflowEntrepriseDb,
  requireWorkflowRole(['ADMIN_ENTITY']), // Seuls les admins peuvent créer
  workflowController.create
);
```

**Routes admin strictes** :
```javascript
router.put('/entities/:entityId',
  authenticateJWT,
  // Vérification directe dans la route (pour routes globales)
  async (req, res) => {
    if (req.user.role !== 'ADMIN_GDRI') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs GDRI peuvent modifier les entités.'
      });
    }
    // ... traitement
  }
);
```

## Structure d'un module

### Organisation des fichiers

```
modules/{nom-module}/
├── backend/
│   ├── index.js                    # Point d'entrée du module
│   ├── routes.js                   # Définition des routes
│   ├── package.json                # Configuration du module
│   ├── controllers/                # Contrôleurs (logique métier)
│   │   └── {module}Controller.js
│   ├── services/                   # Services (accès données)
│   │   └── {Module}Service.js
│   └── middleware/                 # Middlewares spécifiques
│       ├── require{Role}Role.js    # Contrôle d'accès
│       └── use{Module}EntrepriseDb.js # Multitenant
└── frontend/
    ├── index.html                  # Interface utilisateur
    ├── {module}.js                 # JavaScript frontend
    └── {module}.css                # Styles
```

### Point d'entrée du module (`backend/index.js`)

```javascript
const routes = require('./routes');

/**
 * Initialise le module
 * @param {Express} app - Instance Express
 * @param {Database} db - Instance MongoDB principale
 */
async function init(app, db) {
  console.log('  🎯 Initialisation module {NomModule}...');
  // Initialisation spécifique du module (si nécessaire)
}

/**
 * Retourne les routes du module
 * @returns {Express.Router} Routeur Express
 */
function getRoutes() {
  return routes;
}

module.exports = {
  init,
  routes: getRoutes
};
```

### Configuration du module (`backend/package.json`)

```json
{
  "name": "{nom-module}",
  "displayName": "Nom d'affichage du module",
  "version": "1.0.0",
  "description": "Description du module",
  "enabled": true,
  "routes": [
    "/api/{nom-module}"
  ]
}
```

**Propriétés importantes** :
- `enabled` : `true` pour activer le module, `false` pour le désactiver
- `routes` : Tableau des préfixes de routes (ex: `["/api/workflow"]`)

### Définition des routes (`backend/routes.js`)

```javascript
const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../../config/jwt');
const { useModuleEntrepriseDb } = require('./middleware/useModuleEntrepriseDb');
const { requireModuleRole } = require('./middleware/requireModuleRole');
const moduleController = require('./controllers/moduleController');

// Route de santé
router.get('/health', authenticateJWT, useModuleEntrepriseDb, (req, res) => {
  res.json({
    success: true,
    message: 'Module fonctionnel',
    version: '1.0.0'
  });
});

// Routes publiques (lecture)
router.get('/items',
  authenticateJWT,
  useModuleEntrepriseDb,
  requireModuleRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  moduleController.list
);

// Routes admin (écriture)
router.post('/items',
  authenticateJWT,
  useModuleEntrepriseDb,
  requireModuleRole(['ADMIN_ENTITY']),
  moduleController.create
);

router.put('/items/:id',
  authenticateJWT,
  useModuleEntrepriseDb,
  requireModuleRole(['ADMIN_ENTITY']),
  moduleController.update
);

router.delete('/items/:id',
  authenticateJWT,
  useModuleEntrepriseDb,
  requireModuleRole(['ADMIN_ENTITY']),
  moduleController.remove
);

module.exports = router;
```

## Chargement dynamique des modules

### Découverte automatique

Le serveur GDRI découvre automatiquement les modules au démarrage :

1. **Modules internes** : `backend/modules/{nom-module}/`
2. **Modules externes** : `modules/{nom-module}/backend/` (à la racine du projet, pas dans `backend/`)

Les chemins sont résolus en **absolus** à partir de la position du fichier `backend/core/module-registry.js` (donc `BACKEND_ROOT` et `PROJECT_ROOT`). Le chargement fonctionne ainsi quel que soit le répertoire de travail au lancement du serveur (`node server.js` depuis `backend/` ou depuis la racine).

**Dans un module externe** (`modules/<nom>/backend/`), pour accéder au backend GDRI (config, JWT, etc.) utilisez un chemin relatif à la racine du projet : `require('../../../backend/config/database')` depuis tout fichier dans `modules/<nom>/backend/`.

**Fichiers** :
- `backend/core/module-registry.js` : Découverte et enregistrement (expose `PROJECT_ROOT`, `BACKEND_ROOT`)
- `backend/core/module-loader.js` : Chargement dans Express via `path.resolve()` pour des chemins absolus

### Processus de chargement

1. **Découverte** : Scan des dossiers `backend/modules/` et `modules/`
2. **Enregistrement** : Lecture du `package.json` de chaque module
3. **Chargement** : Appel de `module.init(app, db)` puis `module.routes()`
4. **Intégration** : Ajout des routes dans Express avec le préfixe configuré

### Intégration sans redémarrage

**État actuel** : Les modules sont chargés au démarrage du serveur. Pour intégrer un nouveau module, il faut redémarrer le serveur.

**Solution recommandée** : Implémenter un système de **hot-reload** ou **rechargement à chaud** :

1. **Option 1 - Hot-reload automatique** :
   - Utiliser `nodemon` ou `chokidar` pour surveiller les dossiers de modules
   - Recharger automatiquement les modules modifiés
   - **Avantage** : Transparent pour le développeur
   - **Inconvénient** : Peut être instable en production

2. **Option 2 - API de rechargement** :
   - Endpoint admin `/api/admin/modules/reload`
   - Rechargement manuel via interface ou API
   - **Avantage** : Contrôle total
   - **Inconvénient** : Nécessite une action manuelle

3. **Option 3 - Fichier de routes centralisé** :
   - Un fichier `backend/routes/modules.js` qui importe dynamiquement
   - Rechargement via `delete require.cache[...]`
   - **Avantage** : Simple à implémenter
   - **Inconvénient** : Nécessite de modifier le fichier central

**Recommandation** : Pour l'instant, utiliser le redémarrage du serveur. Implémenter l'option 2 (API de rechargement) pour la production.

## Meilleure pratique : Un fichier pour les routes ?

### Approche actuelle

Chaque module définit ses routes dans un fichier `routes.js` séparé. Cette approche est **recommandée** car :

✅ **Avantages** :
- Modularité : Chaque module est autonome
- Maintenabilité : Facile à comprendre et modifier
- Isolation : Les erreurs d'un module n'affectent pas les autres
- Réutilisabilité : Les modules peuvent être déplacés facilement

❌ **Inconvénients** :
- Nécessite un redémarrage pour charger un nouveau module
- Pas de vue d'ensemble centralisée des routes

### Alternative : Fichier centralisé

Un fichier centralisé `backend/routes/all-modules.js` pourrait regrouper toutes les routes :

```javascript
// backend/routes/all-modules.js
const workflowRoutes = require('../modules/workflow/routes');
const chatRoutes = require('../modules/chat/routes');
// ...

module.exports = {
  '/api/workflow': workflowRoutes,
  '/api/chat': chatRoutes,
  // ...
};
```

❌ **Inconvénients** :
- Perte de modularité
- Nécessite de modifier ce fichier pour chaque nouveau module
- Plus difficile à maintenir

**Conclusion** : L'approche actuelle (un fichier `routes.js` par module) est la meilleure solution pour la modularité et la maintenabilité.

## Exemple complet : Module Workflow

### Structure

```
modules/workflow/
├── backend/
│   ├── index.js
│   ├── routes.js
│   ├── package.json
│   ├── controllers/
│   │   └── workflowController.js
│   ├── services/
│   │   └── WorkflowService.js
│   └── middleware/
│       ├── requireWorkflowRole.js
│       └── useWorkflowEntrepriseDb.js
└── frontend/
    ├── builder/
    │   ├── index.html
    │   └── builder.js
    └── viewer/
        ├── index.html
        └── viewer.js
```

### `backend/index.js`

```javascript
const routes = require('./routes');

async function init(app, db) {
  console.log('  🎯 Initialisation module Workflow...');
}

function getRoutes() {
  return routes;
}

module.exports = {
  init,
  routes: getRoutes
};
```

### `backend/routes.js`

```javascript
const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../../config/jwt');
const { useWorkflowEntrepriseDb } = require('./middleware/useWorkflowEntrepriseDb');
const { requireWorkflowRole } = require('./middleware/requireWorkflowRole');
const workflowController = require('./controllers/workflowController');

// Routes publiques
router.get('/workflows',
  authenticateJWT,
  useWorkflowEntrepriseDb,
  requireWorkflowRole(['USER_ENTITY', 'ADMIN_ENTITY']),
  workflowController.list
);

// Routes admin
router.post('/workflows',
  authenticateJWT,
  useWorkflowEntrepriseDb,
  requireWorkflowRole(['ADMIN_ENTITY']),
  workflowController.create
);

module.exports = router;
```

### `backend/middleware/useWorkflowEntrepriseDb.js`

```javascript
const database = require('../../../config/database');

const useWorkflowEntrepriseDb = async (req, res, next) => {
  const user = req.user;
  const entrepriseId = user.currentEntrepriseId || user.entrepriseId;
  
  req.entrepriseDb = await database.getEntrepriseDb(entrepriseId);
  req.entrepriseId = entrepriseId;
  
  next();
};

module.exports = { useWorkflowEntrepriseDb };
```

### `backend/middleware/requireWorkflowRole.js`

```javascript
function requireWorkflowRole(roles = []) {
  const allowed = new Set([...(roles || []), 'ADMIN_GDRI', 'superadmin']);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Non authentifié' 
      });
    }

    if (!allowed.has(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé pour ce module'
      });
    }

    next();
  };
}

module.exports = { requireWorkflowRole };
```

## Checklist pour créer un nouveau module

- [ ] Créer la structure de dossiers `modules/{nom-module}/backend/`
- [ ] Créer `backend/package.json` avec `enabled: true` et `routes`
- [ ] Créer `backend/index.js` avec `init()` et `routes()`
- [ ] Créer `backend/routes.js` avec les routes du module
- [ ] Créer le middleware `use{Module}EntrepriseDb.js` pour le multitenant
- [ ] Créer le middleware `require{Module}Role.js` pour le contrôle d'accès
- [ ] Appliquer les middlewares dans l'ordre : `authenticateJWT` → `useEntrepriseDb` → `requireRole`
- [ ] Tester les routes avec différents rôles (ADMIN_GDRI, ADMIN_ENTITY, USER_ENTITY)
- [ ] Redémarrer le serveur pour charger le module
- [ ] Vérifier que le module apparaît dans `/api/health`

## Résumé des middlewares

| Middleware | Fichier | Usage | Ordre |
|------------|---------|-------|-------|
| `authenticateJWT` | `backend/config/jwt.js` | Authentification JWT | 1 |
| `use{Module}EntrepriseDb` | `modules/{module}/middleware/` | Sélection base multitenant | 2 |
| `require{Module}Role` | `modules/{module}/middleware/` | Contrôle d'accès (rôles) | 3 |

**Ordre d'application** :
```javascript
router.get('/route',
  authenticateJWT,        // 1. Authentification
  useModuleEntrepriseDb,   // 2. Multitenant
  requireModuleRole([...]), // 3. Contrôle d'accès
  controller.handler        // 4. Handler
);
```

## Conclusion

L'architecture GDRI permet d'intégrer facilement de nouveaux modules backend et frontend en respectant les principes de :
- **Sécurité** : Authentification JWT et contrôle d'accès par rôles
- **Isolation** : Bases de données séparées par entreprise (multitenant)
- **Modularité** : Chaque module est autonome et réutilisable
- **Extensibilité** : Ajout de modules sans modifier le code existant

Pour intégrer un nouveau module, suivez la structure décrite et utilisez les middlewares appropriés pour l'authentification, le multitenant et le contrôle d'accès.
