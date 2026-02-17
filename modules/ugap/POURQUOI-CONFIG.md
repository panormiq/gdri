# Pourquoi le module a besoin du fichier config ?

## Architecture GDRI - Système multitenant

Le module UGAP (et tous les modules GDRI) a besoin d'accéder à la configuration pour :

### 1. Connexion à MongoDB (database.js)

Le module utilise `backend/config/database.js` pour :
- Se connecter à MongoDB
- Accéder au système **multitenant** (une base de données par entreprise)
- Utiliser `database.getEntrepriseDb(entrepriseId)` pour obtenir la base de l'entreprise

**Exemple dans le middleware** :
```javascript
const database = require('../../../../backend/config/database');

// Dans le middleware, on récupère la base de l'entreprise
req.entrepriseDb = await database.getEntrepriseDb(entrepriseId);
```

### 2. Authentification JWT (jwt.js)

Le module utilise `backend/config/jwt.js` pour :
- Vérifier les tokens JWT des utilisateurs
- Décoder les informations utilisateur (user_id, entrepriseId, role)
- Protéger les routes avec `authenticateJWT` middleware

**Exemple dans les routes** :
```javascript
const { authenticateJWT } = require('../../../backend/config/jwt');

router.get('/data',
  authenticateJWT,  // Vérifie le token JWT
  useUgapEntrepriseDb,  // Connecte à la base de l'entreprise
  ugapController.getData
);
```

## Pourquoi pas un chemin relatif simple ?

### Structure des dossiers

```
gdri/
├── backend/
│   ├── config/
│   │   ├── database.js  ← Connexion MongoDB multitenant
│   │   └── jwt.js        ← Authentification JWT
│   └── modules/          ← Modules internes
│       └── mail/
└── modules/              ← Modules externes
    └── ugap/
        └── backend/
            ├── routes.js
            └── middleware/
                └── useUgapEntrepriseDb.js  ← Ici on importe database.js
```

### Calcul du chemin

Depuis `modules/ugap/backend/middleware/useUgapEntrepriseDb.js` :
- `../` → `modules/ugap/backend/`
- `../../` → `modules/ugap/`
- `../../../` → `modules/`
- `../../../../` → **racine** (`gdri/`)
- `../../../../backend/config/database` → `backend/config/database.js` ✅

## Alternative : Injection de dépendances

Une alternative serait de passer `database` et `authenticateJWT` en paramètre lors de l'initialisation du module, mais cela compliquerait l'architecture. L'import direct est plus simple et suit le pattern des autres modules GDRI.

## Résumé

Le module a besoin de `config` pour :
1. **database.js** : Accéder au système multitenant MongoDB
2. **jwt.js** : Authentifier les utilisateurs et protéger les routes

Ces fichiers sont partagés par tous les modules GDRI pour garantir la cohérence du système d'authentification et de gestion des bases de données.
