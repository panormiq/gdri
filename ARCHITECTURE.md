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

## Agents IA (à implémenter)

### 1. Agent Analyse d'intention
Caractérise un message/texte pour classification et actions personnalisées.

### 2. Agent Mail
Transfert automatique au bon service selon l'analyse d'intention, prépare des réponses.

### 3. Agent Documentaire Dossier technique
Transforme documents Word en modèles techniques pour simplifier rédactions futures.

### 4. Agent Facebook
Récupère et analyse les notifications Facebook, envoie des alertes mail si réponse nécessaire.

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

### PHP - Includes
- `includes/functions.php` - Fonctions utilitaires (`escape`, `redirect`, `isLoggedIn`, `getUserRole`, `hasRole`, `getRootPath`, `url`, `pageTitle`)
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

