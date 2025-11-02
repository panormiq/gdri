# 🚀 Démarrage Rapide - GDRI

## Ce qui a été créé

✅ **Site vitrine complet** avec :
- Page d'accueil moderne avec votre slogan "Simplifiez-vous la vie"
- Page "Nos Agents" présentant les 4 agents IA en cards
- Page Contact avec formulaire
- Modal de connexion (pas de page séparée)
- Design responsive (mobile, tablette, desktop)
- Thème basé sur les couleurs de votre logo (#9edbeb, #b9e821, #606163, #e4e4e4)

✅ **Système d'authentification** avec 3 rôles :
- ADMIN_GDRI : Gère les entités et leurs autorisations
- ADMIN_ENTITY : Gère les utilisateurs de son entité
- USER_ENTITY : Accède aux services autorisés

✅ **Backend PHP + MongoDB** :
- Structure de base de données MongoDB
- Gestion des sessions sécurisées
- Fonctions utilitaires

## 📋 Les 3 étapes pour faire fonctionner le site

### 1️⃣ Installer Composer
1. Télécharger : https://getcomposer.org/Composer-Setup.exe
2. Installer (suivre l'assistant)
3. Redémarrer PowerShell
4. Dans le dossier du projet, taper :
   ```powershell
   composer install
   ```

### 2️⃣ Installer MongoDB
1. Télécharger MongoDB Community Server : https://www.mongodb.com/try/download/community
2. Installer (choisir "Complete")
3. Télécharger l'extension PHP MongoDB : https://pecl.php.net/package/mongodb
4. Copier `php_mongodb.dll` dans `C:\xampp\php\ext\`
5. Ajouter `extension=mongodb` dans `C:\xampp\php\php.ini`
6. Redémarrer Apache dans XAMPP

### 3️⃣ Copier le logo et initialiser
1. Copier votre logo vers : `C:\xampp\htdocs\gdri\assets\images\logo-gdri.png`
   
   **OU** utiliser le script PowerShell :
   ```powershell
   cd C:\xampp\htdocs\gdri\install
   .\copy-logo.ps1
   ```

2. Initialiser la base de données :
   - Ouvrir : http://localhost/gdri/install/init-db.php
   - Noter les identifiants de l'admin GDRI

3. Accéder au site : http://localhost/gdri/

## 📖 Documentation complète

Pour les instructions détaillées, consultez :
- **INSTALLATION.md** - Guide d'installation complet avec dépannage
- **ARCHITECTURE.md** - Architecture du projet et liste des fichiers
- **README.md** - Vue d'ensemble du projet

## 🎨 Thème de couleurs (depuis votre logo)

- **Bleu clair** : #9edbeb (couleur principale)
- **Vert citron** : #b9e821 (couleur secondaire)
- **Gris foncé** : #606163 (textes)
- **Gris clair** : #e4e4e4 (arrière-plans)

## 📁 Structure du projet

```
gdri/
├── index.php                    # Page d'accueil
├── config/                      # Configuration
├── assets/                      # CSS, JS, Images
├── includes/                    # Header, Footer, Fonctions
├── pages/                       # Pages du site
│   ├── agents.php              # Nos Agents IA
│   ├── contact.php             # Contact
│   └── dashboard.php           # Dashboard protégé
├── auth/                        # Authentification
├── install/                     # Scripts d'installation
├── INSTALLATION.md              # Guide d'installation
└── ARCHITECTURE.md              # Documentation technique
```

## ✨ Fonctionnalités

### Pages publiques (accessibles sans connexion)
- ✅ Accueil
- ✅ Nos Agents (4 agents IA présentés en cards)
- ✅ Contact

### Pages protégées (nécessitent connexion)
- ✅ Dashboard adapté selon le rôle
- ⏳ Backoffice (Phase 2)

### Système de rôles
- **ADMIN_GDRI** : Autorise les entités à accéder à certains services
- **ADMIN_ENTITY** : Autorise les utilisateurs de son entreprise à accéder aux services
- **USER_ENTITY** : Accède aux services autorisés

## 🔧 Prochaines étapes (Phase 2)

Le backoffice sera développé dans un second temps avec :
- Gestion complète des entités (CRUD)
- Gestion des utilisateurs par entité
- Gestion des autorisations de services
- Statistiques et rapports

## 📞 Support

**GDR-Innovation**
- Email : contact@gdr-innovation.fr
- Téléphone : 06 84 28 63 47
- Adresse : 921 impasse de la grange de rideaux
- SIRET : 800944 407

---

💡 **Astuce** : Tous les fichiers JavaScript sont séparés par fonction pour faciliter la maintenance !




