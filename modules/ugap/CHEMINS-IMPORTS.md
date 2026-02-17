# Guide des chemins d'import dans les modules

## Structure des modules

Les modules externes sont dans `modules/{nom-module}/backend/` et doivent importer des fichiers depuis `backend/`.

## Chemins relatifs depuis `modules/{nom-module}/backend/`

### Vers `backend/config/`

Depuis `modules/ugap/backend/routes.js` :
```javascript
// ❌ INCORRECT (2 niveaux)
const { authenticateJWT } = require('../../config/jwt');

// ✅ CORRECT (3 niveaux)
const { authenticateJWT } = require('../../../config/jwt');
```

**Explication** :
- `modules/ugap/backend/` → remonter à `modules/ugap/` (1 niveau : `../`)
- `modules/ugap/` → remonter à `modules/` (2 niveaux : `../../`)
- `modules/` → remonter à la racine (3 niveaux : `../../../`)
- Racine → `backend/config/jwt.js` (4 niveaux : `../../../config/jwt`)

### Vers `backend/services/`

```javascript
// ✅ CORRECT
const Service = require('../../../services/ServiceName');
```

### Vers d'autres fichiers du module

```javascript
// ✅ CORRECT (chemin relatif dans le module)
const controller = require('./controllers/controller');
const middleware = require('./middleware/middleware');
const service = require('./services/service');
```

## Règle générale

Pour importer depuis `backend/` depuis un module dans `modules/{nom-module}/backend/` :
- Utiliser **3 niveaux** : `../../../backend/...`

## Exemples complets

### routes.js
```javascript
const express = require('express');
const router = express.Router();
// ✅ 3 niveaux pour backend/config
const { authenticateJWT } = require('../../../config/jwt');
// ✅ Chemin relatif dans le module
const { useModuleEntrepriseDb } = require('./middleware/useModuleEntrepriseDb');
const controller = require('./controllers/controller');
```

### middleware/useModuleEntrepriseDb.js
```javascript
// ✅ 3 niveaux pour backend/config
const database = require('../../../config/database');
// ✅ Chemin relatif dans le module
const { requireModuleRole } = require('./requireModuleRole');
```

### controllers/controller.js
```javascript
// ✅ 3 niveaux pour backend/services
const Service = require('../../../services/ServiceName');
// ✅ Chemin relatif dans le module
const ModuleService = require('../services/ModuleService');
```

## Vérification

Pour vérifier qu'un chemin est correct, comptez les niveaux :

```
modules/
  └── ugap/
      └── backend/
          ├── routes.js          ← Vous êtes ici
          ├── controllers/
          └── middleware/
backend/                          ← Vous voulez aller ici
  └── config/
      └── jwt.js
```

Depuis `modules/ugap/backend/routes.js` :
1. `../` → `modules/ugap/`
2. `../../` → `modules/`
3. `../../../` → racine
4. `../../../backend/config/jwt` → `backend/config/jwt.js` ✅

## Erreurs communes

### Erreur : "Cannot find module '../../config/jwt'"

**Cause** : Utilisation de 2 niveaux au lieu de 3.

**Solution** : Changer `../../config/jwt` en `../../../config/jwt`

### Erreur : "Cannot find module './config/jwt'"

**Cause** : Chemin relatif incorrect (cherche dans le même dossier).

**Solution** : Utiliser `../../../config/jwt`

## Modules internes vs externes

### Modules internes (`backend/modules/{nom-module}/`)
```javascript
// ✅ 2 niveaux suffisent
const { authenticateJWT } = require('../../config/jwt');
```

### Modules externes (`modules/{nom-module}/backend/`)
```javascript
// ✅ 3 niveaux nécessaires
const { authenticateJWT } = require('../../../config/jwt');
```
