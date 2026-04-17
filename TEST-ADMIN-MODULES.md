# Guide de Test - Administration des Modules Facebook

## ✅ Étapes de vérification

### 1. Vérifier l'accès à la page d'administration

1. **Connectez-vous en tant qu'ADMIN_GDRI**
2. **Dans la navigation**, cliquez sur **"Administration"**
3. **Vérifiez** que vous voyez le menu déroulant avec :
   - Entites
   - Utilisateurs
   - Suivi utilisateurs
   - **Modules** ← Nouveau lien

### 2. Vérifier la page d'administration des modules

1. **Cliquez sur "Modules"** dans le menu Administration
2. **Vérifiez** que vous arrivez sur `/pages/admin-modules.php`
3. **Vérifiez** que vous voyez :
   - Le titre "Administration des Modules"
   - Une **card "Module Facebook"** avec :
     - Icône 📘
     - Titre "Module Facebook"
     - Badge "Configuration globale"
     - Section "État de la configuration" (qui affiche "Chargement..." puis l'état réel)
     - Bouton "⚙️ Configurer le Module Facebook"
     - Bouton "🔗 Tester la connexion Facebook"

### 3. Vérifier l'état de la configuration

**Dans la card Facebook**, la section "État de la configuration" doit afficher :

- **Si non configuré** :
  - ⚠️ Configuration non configurée
  - Message : "L'App ID et l'App Secret Facebook doivent être configurés"
  - Fond jaune (#fff3cd)

- **Si configuré** :
  - ✅ Configuration active
  - App ID : [votre App ID]
  - Fond vert (#d4edda)

### 4. Tester la configuration de l'App Facebook

1. **Cliquez sur "⚙️ Configurer le Module Facebook"**
2. **Vérifiez** que vous arrivez sur `/pages/modules/facebook-app-config.php`
3. **Vérifiez** que vous voyez :
   - Le formulaire avec App ID, App Secret, Redirect URI
   - Bouton "💾 Sauvegarder la configuration"
   - Bouton "📥 Charger la configuration actuelle"
4. **Testez** :
   - Cliquez sur "Charger" → doit charger la config actuelle (si elle existe)
   - Remplissez App ID et App Secret
   - Cliquez sur "Sauvegarder" → doit afficher "✅ Configuration sauvegardée avec succès !"
5. **Retournez** sur la page d'administration (`/pages/admin-modules.php`)
6. **Vérifiez** que l'état de la configuration est maintenant "✅ Configuration active"

### 5. Tester la connexion Facebook (optionnel)

1. **Cliquez sur "🔗 Tester la connexion Facebook"**
2. **Vérifiez** que vous arrivez sur `/pages/modules/facebook-config.php`
3. **Vérifiez** que :
   - Si l'App ID est configuré : le bouton "Se connecter avec Facebook" est actif
   - Si l'App ID n'est pas configuré : un message d'alerte s'affiche

## 🔍 Points à vérifier

### Navigation
- [ ] Le lien "Modules" apparaît dans le menu "Administration"
- [ ] Le lien fonctionne et mène à `/pages/admin-modules.php`

### Page d'administration
- [ ] La page est accessible uniquement pour ADMIN_GDRI
- [ ] La card Facebook s'affiche correctement
- [ ] L'état de la configuration se charge automatiquement
- [ ] Les boutons fonctionnent

### Configuration App
- [ ] La page `facebook-app-config.php` est accessible
- [ ] Le formulaire fonctionne (charger/sauvegarder)
- [ ] La configuration est sauvegardée en base de données

### Sécurité
- [ ] Les utilisateurs non ADMIN_GDRI sont redirigés vers le dashboard
- [ ] Les routes API vérifient bien le rôle ADMIN_GDRI

## 🐛 En cas de problème

### Le lien "Modules" n'apparaît pas
- Vérifiez que vous êtes connecté en tant qu'ADMIN_GDRI
- Videz le cache du navigateur
- Vérifiez le fichier `frontend/includes/header.php` ligne 196

### La page admin-modules.php ne charge pas
- Vérifiez que le fichier existe : `frontend/pages/admin-modules.php`
- Vérifiez les erreurs dans la console du navigateur (F12)
- Vérifiez les logs PHP/Apache

### L'état de la configuration ne se charge pas
- Ouvrez la console du navigateur (F12)
- Vérifiez les erreurs JavaScript
- Vérifiez que l'API `/api/facebook/app-config` répond correctement
- Vérifiez que le token JWT est valide

### La configuration ne se sauvegarde pas
- Vérifiez les erreurs dans la console du navigateur
- Vérifiez que le serveur Node.js est démarré
- Vérifiez les logs du serveur Node.js
- Vérifiez que la base de données MongoDB est accessible
