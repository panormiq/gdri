# Pourquoi importer `database` directement ?

## Architecture GDRI - Système multitenant

### 1. Ce que GDRI passe au module

Quand GDRI initialise un module, il passe :
```javascript
await module.init(app, db);
```

Où `db` est l'instance MongoDB principale (résultat de `database.connect()`).

### 2. Ce dont le module a besoin

Le middleware a besoin d'accéder à la base de données de l'entreprise spécifique via :
```javascript
req.entrepriseDb = await database.getEntrepriseDb(entrepriseId);
```

**Problème** : `db` passé dans `init()` est juste l'instance MongoDB, pas l'objet `database` complet avec ses méthodes comme `getEntrepriseDb()`.

### 3. Solution : Importer `database` directement

Tous les modules GDRI importent directement `database` depuis `backend/config/database` :

**Exemple du module doc-template** :
```javascript
// backend/modules/doc-template/middleware/entreprise/db/useCurrentEntrepriseDb.js
const database = require('../../../../../config/database');

// Dans le middleware
req.entrepriseDb = await database.getEntrepriseDb(entrepriseId);
```

**Exemple du module workflow** :
```javascript
// modules/workflow/backend/middleware/useWorkflowEntrepriseDb.js
const database = require('../../../../backend/config/database');

// Dans le middleware
req.entrepriseDb = await database.getEntrepriseDb(entrepriseId);
```

## Pourquoi c'est correct ?

### `database` est un singleton

Le fichier `backend/config/database.js` exporte une instance unique de la classe `Database` :
```javascript
// backend/config/database.js
class Database {
  async connect() { ... }
  async getEntrepriseDb(entrepriseId) { ... }
}

module.exports = new Database(); // Singleton
```

### Tous les modules utilisent la même instance

Quand plusieurs modules importent `database`, ils obtiennent tous la **même instance** (singleton). Donc :
- ✅ La connexion MongoDB est partagée
- ✅ Le cache des connexions entreprises est partagé
- ✅ Pas de duplication de connexions

## Architecture

```
GDRI Core (server.js)
  ├── database.connect() → Connexion principale
  ├── loadModules(app, database) → Passe db aux modules
  │
  └── Modules
      ├── init(app, db) → Reçoit db (MongoDB instance)
      └── middleware/
          └── require('database') → Accède à database.getEntrepriseDb()
```

## Résumé

- **`db` dans `init()`** : Instance MongoDB principale (pour les opérations globales)
- **`database` importé** : Objet Database complet (pour `getEntrepriseDb()` et autres méthodes)

C'est la même approche que tous les autres modules GDRI (doc-template, workflow, etc.). C'est normal et correct ! ✅
