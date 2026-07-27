# Architecture du projet GDRI

## Vue d'ensemble
Site vitrine + Backend + Backoffice pour GDR-Innovation (SIRET: 800944 407)

## Stack technique
- **Frontend** : HTML5, CSS3 custom, JavaScript vanilla
- **Backend** : PHP 8.x
- **Base de données** : MongoDB
- **Serveur** : XAMPP

## Thème de couleurs (depuis logo)
- Bleu clair : `#9edbeb`
- Vert citron : `#b9e821`
- Gris foncé : `#606163`
- Gris clair : `#e4e4e4`

## Structure des fichiers

```
gdri/
├── index.php                 # Page d'accueil
├── config/
│   ├── database.php         # Connexion MongoDB
│   └── config.php           # Configuration générale
├── assets/
│   ├── css/
│   │   ├── main.css         # Styles principaux
│   │   ├── variables.css    # Variables CSS (couleurs, etc.)
│   │   └── responsive.css   # Media queries
│   ├── js/
│   │   ├── main.js          # JavaScript principal
│   │   ├── modal.js         # Gestion modal login
│   │   └── navigation.js    # Menu responsive
│   └── images/
│       └── logo-gdri.png    # Logo de l'entreprise
├── includes/
│   ├── header.php           # En-tête commun
│   ├── footer.php           # Pied de page commun
│   └── functions.php        # Fonctions utilitaires PHP
├── pages/
│   ├── agents.php           # Page "Nos Agents" (publique)
│   ├── contact.php          # Page Contact (publique)
│   └── dashboard.php        # Dashboard (protégé)
├── auth/
│   ├── login-process.php    # Traitement connexion
│   ├── logout.php           # Déconnexion
│   └── session.php          # Gestion des sessions
├── api/
│   └── (endpoints API futurs)
├── admin/
│   └── (backoffice - phase 2)
├── composer.json            # Dépendances PHP
└── README.md               # Documentation
```

## Pages publiques
- **Accueil** (`/index.php`) : Présentation GDRI, slogan "Simplifiez-vous la vie"
- **Nos Agents** (`/pages/agents.php`) : Cards des agents IA
- **Contact** (`/pages/contact.php`) : Formulaire de contact

## Système d'authentification

### Modal de login
- Modal overlay (pas de page séparée)
- Login avec email + password

### Rôles utilisateurs
1. **ADMIN_GDRI** : Gère les entités et leurs autorisations
2. **ADMIN_ENTITY** : Gère les utilisateurs de son entité
3. **USER_ENTITY** : Accès aux services autorisés

### Règles d'accès
- Seules les pages Accueil, Nos Agents et Contact sont publiques
- Toutes les autres routes nécessitent authentification
- Dashboard adapté selon le rôle

## Base de données MongoDB

### Collections

#### `users`
```javascript
{
  _id: ObjectId,
  email: String,
  password_hash: String,
  role: String, // 'ADMIN_GDRI', 'ADMIN_ENTITY', 'USER_ENTITY'
  entity_id: ObjectId, // null pour ADMIN_GDRI
  status: String, // 'active', 'inactive'
  created_at: Date,
  updated_at: Date
}
```

#### `entities`
```javascript
{
  _id: ObjectId,
  name: String,
  siret: String,
  address: String,
  status: String, // 'active', 'inactive'
  services_authorized: [ObjectId], // IDs des services autorisés
  created_at: Date,
  updated_at: Date
}
```

#### `services`
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  icon: String,
  status: String, // 'active', 'inactive'
  created_at: Date
}
```

## Agents IA & automatisation

> Architecture cible : **[`AGENT-AUTOMATION.md`](AGENT-AUTOMATION.md)**  
> Connecteurs I/O : [`CONNECTOR-SDK.md`](CONNECTOR-SDK.md)

### Principe

Multi-canaux (mail, contact, WhatsApp, FB…) → **adapteur** (options selon le trigger) → **pipeline métier commun**.  
App user = config (intentions, routage, canaux) ; flows = automatisations gérées automatiquement.

### Agents produits (exemples)

1. **Analyse d'intention** — brique réutilisable (pas une app isolée).
2. **Agent multi-canal** (mail / contact / WhatsApp…) — devis auto, routage SAV, etc.
3. **Agent Documentaire** — dossier technique (module dédié).
4. **Agent Facebook** — legacy webhook encore actif ; bascule progressive vers l’orchestrateur.

Legacy Facebook / Mail : **conservés** jusqu’à stabilisation de l’outil agent.

**Structure du module :**
```
backend/modules/agent-documentaire/
├── index.js                      # Point d'entrée
├── routes.js                     # Routes API
├── services/
│   └── DocumentService.js        # Service principal (CRUD documents)
├── extractors/                   # Extraction Word → JSON
│   ├── wordtojson.js             # Point d'entrée extraction
│   └── methodes/                 # Méthodes d'extraction par tag
│       ├── extract-paragraph.js
│       ├── extract-heading.js
│       ├── extract-image.js
│       ├── extract-table.js
│       ├── extract-section.js    # Gestion sections/chapitres
│       └── extract-toc.js        # Extraction table des matières
├── generators/                   # Génération JSON → HTML
│   ├── jsontohtml.js             # Point d'entrée génération
│   └── methodes/                 # Méthodes de génération par type
│       ├── generate-paragraph.js
│       ├── generate-heading.js
│       ├── generate-image.js
│       ├── generate-table.js
│       └── generate-section.js
├── storage/                      # Stockage fichiers
│   ├── documents/                # Documents Word originaux
│   └── images/                   # Images extraites
├── config/
│   └── lockable-properties.json # Configuration des verrous
└── src-test/                     # Fichiers de test
```

**Workflow :**
- Word → JSON (extraction unique, JSON stocké en MongoDB comme source de vérité)
- JSON → HTML (génération à la volée pour affichage uniquement)
- Modifications WYSIWYG → API → Mise à jour directe du JSON
- HTML régénéré depuis JSON mis à jour

**Routes API :**
- `POST /api/agent-documentaire/upload` - Upload fichier Word
- `POST /api/agent-documentaire/extract/:documentId` - Extraire Word → JSON
- `GET /api/agent-documentaire/document/:documentId` - Récupérer JSON
- `PUT /api/agent-documentaire/document/:documentId` - Mettre à jour JSON
- `PUT /api/agent-documentaire/document/:documentId/sections` - Réorganiser sections
- `GET /api/agent-documentaire/document/:documentId/html` - Générer HTML
- `POST /api/agent-documentaire/document/:documentId/image/temp` - Upload d'une image temporaire (drag & drop)
- `GET /api/agent-documentaire/document/:documentId/temp-image/:sessionId/:imageId` - Prévisualiser une image temporaire
- `POST /api/agent-documentaire/document/:documentId/images/promote` - Promouvoir les images temporaires lors de la sauvegarde
- `POST /api/agent-documentaire/document/:documentId/image` - Upload direct (legacy)
- `GET /api/agent-documentaire/document/:documentId/image/:imageId` - Récupérer image

**Fonctions principales :**
- `DocumentService.uploadWordDocument(req)` - Upload d'un fichier Word
- `DocumentService.loadWordDocument(filename)` - Charge fichier Word (fichier par défaut si filename null)
- `DocumentService.extractWordToJson(documentId, filename)` - Extraction Word → JSON
- `DocumentService.getDocument(documentId)` - Récupère un document
- `DocumentService.updateDocument(documentId, jsonContent)` - Met à jour le JSON
- `DocumentService.reorganizeSections(documentId, sections)` - Réorganise les sections
- `DocumentService.renumberSections(sections)` - Recalcule niveaux + numérotation à partir de l'arbre
- `DocumentService.generateTocFromSections(sections)` - Génère le TOC plat cohérent avec les sections
- `DocumentService.generateHtmlFromJson(documentId)` - Génère HTML depuis JSON
- `DocumentService.saveUploadedImage(documentId, file, options)` - Sauvegarde immédiate (mode legacy)
- `DocumentService.saveTempImage(documentId, sessionId, file)` - Stocke une image drag & drop dans un dossier temporaire
- `DocumentService.promoteTempImages(documentId, sessionId, images)` - Déplace les images temporaires vers le stockage définitif
- `WordToJson.extract(wordFilePath)` - Extraction Word → JSON (extractors/wordtojson.js)
- `JsonToHtml.generate(jsonContent)` - Génération JSON → HTML (generators/jsontohtml.js)

**Frontend (agent-documentaire.js) :**
- `initContentDragAndDrop()` - Initialisation du drag & drop d'images dans la zone de contenu (binding des events + fallback mobile)
- `handleImageFileDrop(file, context)` - Gère l'import d'une image (lecture dimensions, upload temp, insertion/remplacement dans `sectionsTree`)
- `collectTempImageMappings()` / `promoteTempImages()` - Gestion de la promotion des images temporaires avant sauvegarde
- `saveDocumentChanges()` - Bouton "Sauvegarder" : sérialise le JSON, promeut les images, déclenche le `PUT /document/:id`

### 4. Module Workflow (builder / viewer)

Module de création et consultation de workflows avec séparation admin/user.

**Structure du module :**
```
modules/workflow/backend/
├── index.js                          # Point d'entrée du module
├── routes.js                         # Routes API
├── controllers/
│   └── workflowController.js         # CRUD workflows
├── services/
│   └── WorkflowService.js            # Accès MongoDB (workflows)
└── middleware/
    ├── requireWorkflowRole.js        # Contrôle d'accès par rôle
    └── useWorkflowEntrepriseDb.js    # Multi-tenant (DB entreprise)

modules/workflow/frontend/
├── builder/                          # Builder (admin)
│   ├── index.html
│   ├── builder/                      # Fichiers JS découpés
│   └── builder.css
├── viewer/                           # Viewer (user)
│   ├── index.html
│   ├── workflow-viewer.js
│   └── tutorial.css
└── shared/                           # Données mutualisées (builder + viewer)
    ├── assets/
    ├── block/
    ├── bricks/
    ├── workflows/
    ├── workflow.json
    ├── tutorial.json
    └── config.js                     # API base URL
```

**Helpers front builder (modules/workflow/frontend/builder/builder/)** :
- `isRemotePath(value)` : détecte une URL distante pour éviter les préfixes locaux.
- `normalizeBlockPath(path)` : normalise un chemin de block en `block/...`.
- `normalizeSharedPath(path)` : préfixe un chemin local avec `../shared/` si nécessaire.
- `fetchApiJson(path, options)` : wrapper fetch JSON avec credentials vers l’API workflow.
- `isApiWorkflowPath(path)` : détecte un chemin workflow `api:<id>`.
- `getApiWorkflowId(path)` : extrait l’ID d’un chemin workflow `api:<id>`.

**Routes API :**
- `GET /api/workflow/health` - Vérifie l'état du module
- `GET /api/workflow/workflows` - Liste des workflows (viewer + admin)
- `GET /api/workflow/workflows/:id` - Détails d'un workflow
- `POST /api/workflow/workflows` - Création (admin)
- `PUT /api/workflow/workflows/:id` - Mise à jour (admin)
- `DELETE /api/workflow/workflows/:id` - Suppression (admin)

**Rôles :**
- `ADMIN_GDRI` / `ADMIN_ENTITY` : création, édition, suppression
- `USER_ENTITY` : lecture (viewer)

**Collections (par entreprise) :**
- `workflows` : documents de workflow (payload complet du builder)

### 5. Agent Facebook
Récupère et analyse les notifications Facebook, envoie des alertes mail si réponse nécessaire.

### 6. Module Chat (Ollama)
Module de chat pour communiquer avec le serveur IA local (Ollama).

**Structure du module :**
```
modules/chat/backend/
├── index.js                      # Point d'entrée du module
├── routes.js                     # Routes API
└── services/
    └── ChatService.js            # Proxy vers Ollama
```

**Routes API :**
- `POST /api/chat/message` - Envoyer un message au modèle
- `GET /api/chat/health` - Tester la connexion à Ollama

**Fonctions principales :**
- `init(app, db)` - Initialise le module chat (modules/chat/backend/index.js)
- `getRoutes()` - Retourne le routeur du module (modules/chat/backend/index.js)
- `getChatService()` - Singleton du service chat (modules/chat/backend/routes.js)
- `ChatService.sendMessage(message, options)` - Envoie un message à Ollama
- `ChatService.testConnection()` - Test de connexion à Ollama

## Informations entreprise
- **Nom** : GDR-Innovation (GDRI)
- **SIRET** : 800944 407
- **Adresse** : 921 impasse de la grange de rideaux
- **Email** : contact@gdr-innovation.fr
- **Téléphone** : 06 84 28 63 47
- **Slogan** : "Simplifiez-vous la vie"

## Fichiers créés

### Configuration
- `composer.json` - Dépendances PHP
- `config/config.php` - Configuration générale
- `config/database.php` - Connexion MongoDB (fonction `getDatabase()`)
- `.htaccess` - Configuration Apache
- `.gitignore` - Fichiers à ignorer par Git

### Frontend
- `assets/css/variables.css` - Variables CSS (couleurs du logo)
- `assets/css/main.css` - Styles principaux
- `assets/css/modal.css` - Styles du modal de login
- `assets/css/responsive.css` - Media queries responsive

### JavaScript
- `assets/js/main.js` - Initialisation principale
- `assets/js/modal.js` - Gestion du modal (fonctions: `openModal`, `closeModal`, `initModal`)
- `assets/js/navigation.js` - Navigation responsive (fonctions: `toggleMobileMenu`, `closeMobileMenu`, `handleScroll`, `setActiveLink`, `initNavigation`)
- `assets/js/form-validation.js` - Validation formulaires (fonctions: `validateEmail`, `validatePassword`, `showError`, `hideError`, `showSuccess`, `handleLoginSubmit`, `initFormValidation`)

### Doc-template V3 (frontend)
- `frontend/pages/modules/doc-template-v3/document/DocumentEditorPage.js` - `reorderContentToMatchTOC(hierarchy)` : réordonne le contenu HTML du document pour refléter l’ordre du TOC après drag & drop.
- `frontend/pages/modules/doc-template-v3/document/DocumentViewPage.js` - `renderReadOnlyEditor(container)` : affiche le document via le builder en lecture seule (mêmes marges et scaling).
- `frontend/pages/modules/doc-template-v3/document/DocumentViewPage.js` - `getPageSizePx(pageSize, orientation, pagination)` : convertit un format de page (A4/custom) en dimensions px.
- `frontend/pages/modules/doc-template-v3/document/DocumentViewPage.js` - `normalizeCssLength(value)` : normalise une longueur CSS (string/number) pour les marges.

### Doc-template V2 (frontend)
- `frontend/pages/modules/document-editor-v2/src/document/DocumentEditorPage.js` - `reorderContentToMatchTOC(hierarchy)` : réordonne le contenu HTML du document pour refléter l’ordre du TOC après drag & drop.

### Doc-template backend (PDF)
- `backend/modules/doc-template/controllers/documentController.js` - `getTemplatePageSizeCm(pagination)` : calcule la taille page (cm) pour le PDF à partir du template.
- `backend/modules/doc-template/controllers/documentController.js` - `buildTemplateCss(template)` : génère le CSS de titres/typo pour un rendu PDF identique au template.
- `backend/modules/doc-template/controllers/documentController.js` - `exportHtmlToPdf(req, res)` : génère un PDF depuis un HTML fourni (viewer).
### Doc-template frontend (PDF)
- `frontend/pages/modules/doc-template-v3/document/utils/pdfHtmlExporter.js` - `buildInlinePdfHtml(editorElement)` : génère un HTML inline pour export PDF fidèle au viewer.
- `backend/modules/doc-template/services/DocumentGenerationService.js` - `isImageValue(value)` : détecte si une valeur correspond à une image (objet image).
- `backend/modules/doc-template/services/DocumentGenerationService.js` - `buildCollectionImageUrl(imageData, collectionId)` : construit l'URL API d'une image de collection.
- `backend/modules/doc-template/services/DocumentGenerationService.js` - `resolveVariableImage(variablePath, variables)` : résout une variable d'image (valeur + collectionId).
- `backend/modules/doc-template/services/DocumentGenerationService.js` - `replaceVariableImagesInHtml(html, variables)` : remplace les `img[data-variable-path]` par les URLs réelles.

### PHP - Includes
- `includes/functions.php` - Fonctions utilitaires (`escape`, `redirect`, `isLoggedIn`, `getUserRole`, `hasRole`, `getRootPath`, `url`, `pageTitle`, `syncServicesWithFilesystemModules($db)`)
- `includes/header.php` - Header HTML commun
- `includes/footer.php` - Footer HTML commun

### PHP - Pages publiques
- `index.php` - Page d'accueil
- `pages/agents.php` - Page "Nos Agents" avec les 4 agents IA
- `pages/contact.php` - Page de contact avec formulaire

### PHP - Authentification
- `auth/session.php` - Gestion sessions (fonction `startSecureSession`)
- `auth/login-process.php` - Traitement connexion (fonction `jsonResponse`)
- `auth/logout.php` - Déconnexion

### PHP - Dashboard
- `pages/dashboard.php` - Dashboard adapté selon le rôle (ADMIN_GDRI, ADMIN_ENTITY, USER_ENTITY)

### PHP - Administration
- `pages/entities.php` - Gestion des entités et des utilisateurs (ADMIN_GDRI)
- `pages/entity-modules.php` - Attribution des modules à une entité (ADMIN_GDRI)
- `pages/users.php` - Gestion des utilisateurs et permissions modules d'une entreprise (ADMIN_ENTITY)

### Backend - Serveur Node
- `backend/server.js` - `ensureGdriEntity()` : vérifie/crée l'entité GDRI, initialise la base d'entreprise et rattache les admins GDRI (params: aucun).

### Module UGAP (backend Node)
- `modules/ugap/backend/services/ExcelTableDetector.js` - `detectTablesFromWorksheet(ws, range, options?)` : détecte les "tableaux" dans une feuille Excel (1 tableau = bloc de lignes consécutives non vides, séparé par des lignes vides). Retourne `{ count, tables }` avec `tables=[{start,end}]` (indices de lignes 0-based). Options: `startRow/endRow/startCol/endCol/trimEmptyColumns` (défaut `true`: démarre à la 1ère colonne non vide).

### Installation
- `INSTALLATION.md` - Guide d'installation complet
- `install/init-db.php` - Script d'initialisation de la base de données
- `install/copy-logo.ps1` - Script PowerShell pour copier le logo

### Documentation
- `README.md` - Documentation du projet
- `ARCHITECTURE.md` - Architecture détaillée

## À faire (Phase 1)
- [x] Structure des fichiers
- [x] Frontend complet (HTML/CSS/JS)
- [x] Système de modal de connexion
- [x] Pages publiques (Accueil, Nos Agents, Contact)
- [x] Dashboard par rôle
- [ ] Installation Composer + MongoDB driver (à faire par l'utilisateur)
- [ ] Copie du logo dans assets/images/
- [ ] Initialisation de la base de données
- [ ] Test complet du site

## À faire (Phase 2)
- [ ] Backoffice complet
- [ ] Gestion des entités (ADMIN_GDRI)
- [ ] Gestion des utilisateurs (ADMIN_ENTITY)
- [ ] Gestion des services

