# Guide Démonstration Vidéo - OAuth Facebook

## 🎯 Objectif

Montrer comment une autre personne/entreprise peut connecter sa page Facebook à GDRI via OAuth.

## ✅ Ce qui est déjà implémenté

1. **Interface de connexion OAuth** : Bouton "Se connecter avec Facebook"
2. **Flux OAuth complet** : 
   - Génération de l'URL d'authentification
   - Callback pour recevoir le code
   - Échange du code contre un token
   - Récupération des pages Facebook
   - Sauvegarde automatique de la configuration

## 🎬 Scénario pour la vidéo

### Étape 1 : Configuration de l'application (ADMIN_GDRI)

1. Se connecter en tant qu'**ADMIN_GDRI**
2. Aller sur la page de configuration Facebook
3. Dans la section "Configuration Application Facebook" :
   - Entrer l'**App ID** Facebook
   - Entrer l'**App Secret** Facebook
   - Vérifier l'URL de redirection
   - Cliquer sur "Sauvegarder"

**💡 Important** : Expliquer que cette étape se fait une seule fois par l'administrateur GDRI.

### Étape 2 : Connexion d'une page Facebook (Utilisateur)

1. Se connecter avec un compte utilisateur (peut être une autre entreprise)
2. Aller sur la page de configuration Facebook
3. Cliquer sur **"Se connecter avec mon compte Facebook"**
4. **Redirection vers Facebook** :
   - Se connecter avec son compte Facebook personnel
   - Autoriser l'application GDRI
   - Voir les permissions demandées (pages_show_list, pages_read_engagement, etc.)
5. **Retour automatique vers GDRI** :
   - Si une seule page : connexion automatique
   - Si plusieurs pages : sélection de la page
6. **Confirmation** : La page est connectée et configurée

### Étape 3 : Vérification

1. Afficher la section "Configuration actuelle"
2. Voir le Page ID et le nom de la page connectée
3. Expliquer que maintenant les webhooks vont arriver pour cette page

## 📋 Points à expliquer dans la vidéo

### 1. Pourquoi OAuth ?

- **Sécurité** : L'utilisateur autorise explicitement l'accès
- **Simplicité** : Pas besoin de générer manuellement des tokens
- **Automatique** : Le Page Access Token est récupéré automatiquement
- **Multi-utilisateurs** : Chaque entreprise peut connecter ses propres pages

### 2. Le flux OAuth

```
1. Utilisateur clique "Se connecter avec Facebook"
   ↓
2. Redirection vers Facebook (login)
   ↓
3. Utilisateur autorise l'application
   ↓
4. Facebook redirige vers GDRI avec un code
   ↓
5. GDRI échange le code contre un token
   ↓
6. GDRI récupère les pages de l'utilisateur
   ↓
7. Configuration sauvegardée automatiquement
```

### 3. Permissions demandées

Expliquer les permissions :
- `pages_show_list` : Pour lister les pages de l'utilisateur
- `pages_read_engagement` : Pour lire les posts et commentaires
- `pages_manage_posts` : Pour créer des posts (optionnel)

### 4. Sécurité

- Le token est stocké de manière sécurisée dans MongoDB
- Chaque entreprise a sa propre configuration
- L'utilisateur peut déconnecter à tout moment

## 🎥 Script de démonstration

### Partie 1 : Configuration Admin (2-3 min)

1. "D'abord, l'administrateur GDRI doit configurer l'application Facebook"
2. Montrer la section "Configuration Application Facebook"
3. Expliquer où trouver App ID et App Secret
4. Sauvegarder la configuration

### Partie 2 : Connexion utilisateur (3-4 min)

1. "Maintenant, montrons comment un utilisateur connecte sa page"
2. Cliquer sur "Se connecter avec mon compte Facebook"
3. **Montrer la redirection vers Facebook** (important !)
4. Montrer l'écran d'autorisation Facebook
5. Expliquer les permissions
6. Autoriser
7. **Montrer le retour automatique vers GDRI**
8. Montrer la page connectée

### Partie 3 : Test (1-2 min)

1. "Maintenant que la page est connectée, testons avec un événement réel"
2. Utiliser le script `create-test-event.js` ou créer un post manuellement
3. Montrer les logs du webhook qui arrive
4. Expliquer que c'est automatique

## ⚠️ Points d'attention pour la vidéo

1. **Ne pas montrer les tokens** : Masquer App Secret et Access Tokens
2. **Montrer la redirection** : C'est important de voir le flux OAuth complet
3. **Expliquer les permissions** : Pourquoi on demande ces permissions
4. **Montrer la sélection de page** : Si plusieurs pages sont disponibles
5. **Tester avec un compte différent** : Montrer que ça fonctionne pour n'importe quel utilisateur

## 🔍 Vérifications avant la vidéo

- [ ] L'App Facebook est configurée dans Facebook Developers
- [ ] L'URL de redirection est configurée dans Facebook Developers
- [ ] App ID et App Secret sont configurés dans GDRI
- [ ] Le serveur backend est démarré
- [ ] Tester avec un compte de test avant la vidéo

## 📝 Checklist pour la vidéo

- [ ] Montrer la configuration admin (App ID/Secret)
- [ ] Montrer le bouton "Se connecter avec Facebook"
- [ ] Montrer la redirection vers Facebook
- [ ] Montrer l'écran d'autorisation Facebook
- [ ] Montrer le retour automatique vers GDRI
- [ ] Montrer la page connectée
- [ ] Tester avec un événement réel
- [ ] Montrer les logs du webhook
