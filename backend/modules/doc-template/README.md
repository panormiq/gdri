# Module Doc-Template V3

Module de gestion de documents et templates intégré dans GDRI.

## Version

3.0.0

## Description

Module permettant de :
- Gérer des collections de données (schemas et éléments)
- Créer et éditer des templates de documents
- Générer des documents à partir de templates et de données
- Gérer le stockage de fichiers

## Structure

```
doc-template/
├── index.js              # Point d'entrée du module
├── routes.js             # Routes API
├── config.json           # Configuration du module
├── models/               # Modèles MongoDB
│   ├── template_model.js
│   ├── collection_model.js
│   └── document_model.js
├── services/             # Services métier
│   ├── CollectionSnapshotService.js
│   ├── DocumentGenerationService.js
│   └── StorageService.js
├── controllers/          # Controllers Express
│   ├── collectionController.js
│   ├── template_controller.js
│   ├── documentController.js
│   └── storageController.js
└── middleware/           # Middlewares
    └── entreprise/
        ├── db/
        │   └── useCurrentEntrepriseDb.js
        └── access/
            └── checkEntrepriseAccess.js
```

## Routes API

Toutes les routes sont préfixées par `/api/doc-template`

### Collections
- `GET /collections` - Liste des collections
- `GET /collections/:id` - Détails d'une collection
- `POST /collections` - Créer une collection
- `PUT /collections/:id` - Mettre à jour une collection
- `DELETE /collections/:id` - Supprimer une collection

### Templates
- `GET /templates` - Liste des templates
- `GET /templates/:id` - Détails d'un template
- `POST /templates` - Créer un template
- `PUT /templates/:id` - Mettre à jour un template
- `DELETE /templates/:id` - Supprimer un template

### Documents
- `GET /documents` - Liste des documents
- `GET /documents/:id` - Détails d'un document
- `POST /documents` - Créer un document
- `PUT /documents/:id` - Mettre à jour un document
- `DELETE /documents/:id` - Supprimer un document
- `POST /documents/generate` - Générer un document à la volée

### Storage
- `POST /storage/upload` - Uploader un fichier
- `GET /storage/files` - Lister les fichiers
- `GET /storage/files/:filename` - Télécharger un fichier
- `DELETE /storage/files/:filename` - Supprimer un fichier

## Authentification

Le module utilise l'authentification GDRI :
- HttpOnly cookies (prioritaire)
- Headers Authorization (fallback)

Le `entrepriseId` est récupéré depuis `req.user.entrepriseId` (fourni par `authenticateJWT` de GDRI).

## Multi-tenancy

Le module utilise le système multi-DB de GDRI :
- Base principale : `GDR-INNOVATION`
- Bases entreprises : `GDR-ENTREPRISE-{entrepriseId}`

Chaque entreprise a sa propre base de données MongoDB pour l'isolation des données.

## Configuration

Le module est configuré via `config.json` :
```json
{
  "name": "doc-template",
  "displayName": "Doc Template",
  "routes": ["/api/doc-template"],
  "enabled": true
}
```

## Dépendances

- `express` - Framework web
- `mongodb` - Driver MongoDB
- `jsonwebtoken` - JWT (via GDRI)
- `cookie-parser` - Gestion cookies (via GDRI)

## Notes

- Les modèles utilisent `database.getEntrepriseDb()` de GDRI
- Les middlewares utilisent `req.user.entrepriseId` (format GDRI)
- Tous les imports ont été adaptés pour la structure modulaire GDRI
