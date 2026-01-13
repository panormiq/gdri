# Fichiers manquants dans le module doc-template GDRI

## ❌ Problème identifié

Le fichier `routes.js` tente d'importer des contrôleurs, modèles et services qui **n'existent pas** dans le module.

## 📋 Fichiers manquants

### Controllers (manquants)
Les fichiers `routes.js` importe ces contrôleurs qui n'existent pas :
- ❌ `./controllers/collectionController.js`
- ❌ `./controllers/template_controller.js`
- ❌ `./controllers/documentController.js`
- ❌ `./controllers/storageController.js`
- ❌ `./controllers/documentGenerationController.js`

### Modèles (manquants)
Le README mentionne ces modèles mais ils n'existent pas :
- ❌ `models/template_model.js`
- ❌ `models/collection_model.js`
- ❌ `models/document_model.js`

### Services (manquants)
Le README mentionne ces services mais ils n'existent pas :
- ❌ `services/CollectionSnapshotService.js`
- ❌ `services/DocumentGenerationService.js`
- ❌ `services/StorageService.js`

### Middlewares (manquants)
Le README mentionne ces middlewares mais ils n'existent pas :
- ❌ `middleware/entreprise/db/useCurrentEntrepriseDb.js`
- ❌ `middleware/entreprise/access/checkEntrepriseAccess.js`

## 📦 Fichiers disponibles dans doc_template original

### Controllers (dans `continue/doc_template/back/controllers/`)
- ✅ `collectionController.js`
- ✅ `template_controller.js`
- ✅ `documentController.js`
- ✅ `storageController.js`
- ✅ `documentGenerationController.js`
- ✅ `documentVersionController.js` (non mentionné dans routes.js GDRI)
- ✅ `collectionImagesController.js` (non mentionné dans routes.js GDRI)
- ✅ `fieldsController.js` (non mentionné dans routes.js GDRI)
- ✅ `schemaController.js` (non mentionné dans routes.js GDRI)
- ✅ `authController.js` (géré par GDRI)
- ✅ `userController.js` (géré par GDRI)
- ✅ `entrepriseController.js` (géré par GDRI)
- ✅ `passwordResetController.js` (géré par GDRI)

### Modèles (dans `continue/doc_template/back/models/`)
- ✅ `template_model.js`
- ✅ `collection_model.js`
- ✅ `document_model.js`
- ✅ `entreprise_model.js` (géré par GDRI)
- ✅ `user_model.js` (géré par GDRI)
- ✅ `passwordResetToken_model_featuring.js` (géré par GDRI)

### Services (dans `continue/doc_template/back/services/`)
- ✅ `CollectionSnapshotService.js`
- ✅ `DocumentGenerationService.js`
- ✅ `TemplateSnapshotService.js` (non mentionné dans README GDRI)
- ✅ `StorageService.js` (peut-être dans utils/)

### Middlewares (dans `continue/doc_template/back/middleware/`)
- ✅ `entreprise/db/useCurrentEntrepriseDb.js`
- ✅ `entreprise/access/checkEntrepriseAccess.js`
- ✅ Et d'autres middlewares spécifiques

## 🔧 Action requise

**TOUS les fichiers doivent être copiés depuis `continue/doc_template/back/` vers `gdri/backend/modules/doc-template/`**

### Structure à créer :
```
gdri/backend/modules/doc-template/
├── controllers/
│   ├── collectionController.js
│   ├── template_controller.js
│   ├── documentController.js
│   ├── storageController.js
│   ├── documentGenerationController.js
│   ├── documentVersionController.js
│   ├── collectionImagesController.js
│   ├── fieldsController.js
│   └── schemaController.js
├── models/
│   ├── template_model.js
│   ├── collection_model.js
│   └── document_model.js
├── services/
│   ├── CollectionSnapshotService.js
│   ├── DocumentGenerationService.js
│   ├── TemplateSnapshotService.js
│   └── StorageService.js (ou utils/storage.js)
└── middleware/
    └── entreprise/
        ├── db/
        │   └── useCurrentEntrepriseDb.js
        └── access/
            └── checkEntrepriseAccess.js
```

## ⚠️ Notes importantes

1. **Les fichiers doivent être adaptés** pour utiliser la structure GDRI :
   - `req.user.entrepriseId` au lieu de `req.user.currentEntrepriseId`
   - `database.getEntrepriseDb()` au lieu de `req.entrepriseDb`
   - Imports relatifs adaptés

2. **Certains fichiers peuvent être partagés avec GDRI** :
   - Auth, User, Entreprise sont gérés par GDRI
   - Mais les modèles spécifiques à doc-template doivent être copiés

3. **Le module ne fonctionne PAS actuellement** car les imports échouent !
