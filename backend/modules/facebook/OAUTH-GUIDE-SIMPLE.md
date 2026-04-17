# Guide OAuth Facebook - Simple et Direct

## ✅ Ce qui est déjà fait

1. **Routes OAuth créées** :
   - `GET /api/facebook/oauth/login` - Génère l'URL Facebook
   - `GET /api/facebook/oauth/callback` - Reçoit la réponse de Facebook
   - `POST /api/facebook/oauth/select-page` - Sélectionne une page
   - `GET /api/facebook/oauth/pages` - Liste les pages

2. **Interface frontend** :
   - Bouton "Se connecter avec Facebook"
   - Formulaire pour configurer App ID et App Secret (ADMIN_GDRI)

3. **Code backend** :
   - Échange du code OAuth contre un token
   - Récupération des pages Facebook
   - Sauvegarde automatique de la configuration

## 🚀 Pour que ça marche

### Étape 1 : Configurer l'App Facebook dans Facebook Developers

1. Allez sur https://developers.facebook.com/apps/
2. Créez ou sélectionnez votre App
3. Notez votre **App ID** et **App Secret** (Paramètres → De base)

### Étape 2 : Configurer l'URL de redirection dans Facebook

1. Dans votre App Facebook → **Produits** → **Facebook Login** → **Paramètres**
2. Ajoutez cette URL dans "URL de redirection OAuth valides" :
   ```
   https://www.gdr-innovation.fr/api/facebook/oauth/callback
   ```
3. Sauvegardez

### Étape 3 : Configurer dans GDRI

1. Connectez-vous en tant qu'**ADMIN_GDRI**
2. Allez sur la page de configuration Facebook
3. Dans la section "Configuration Application Facebook" :
   - Entrez votre **App ID**
   - Entrez votre **App Secret**
   - Vérifiez que l'URL de redirection est correcte
   - Cliquez sur "Sauvegarder la configuration"

### Étape 4 : Redémarrer le serveur backend

```bash
# Arrêter le serveur (Ctrl+C)
# Puis relancer :
node backend/server.js
```

### Étape 5 : Tester la connexion

1. Allez sur la page de configuration Facebook
2. Cliquez sur "Se connecter avec mon compte Facebook"
3. Vous serez redirigé vers Facebook
4. Connectez-vous avec votre compte Facebook personnel
5. Autorisez l'application
6. Vous serez redirigé vers GDRI avec la page connectée

## 🔍 Vérification

Si ça ne marche pas, vérifiez :

1. **Les logs du serveur backend** - Regardez les messages d'erreur
2. **La console du navigateur** - Regardez les erreurs JavaScript
3. **La configuration Facebook** - Vérifiez que l'URL de redirection est bien configurée
4. **Les identifiants** - Vérifiez que App ID et App Secret sont corrects

## 📝 Flux complet

```
1. Utilisateur clique "Se connecter avec Facebook"
   ↓
2. GET /api/facebook/oauth/login
   → Génère URL: https://www.facebook.com/v24.0/dialog/oauth?...
   ↓
3. Redirection vers Facebook
   → Utilisateur se connecte et autorise
   ↓
4. Facebook redirige vers /api/facebook/oauth/callback?code=XXX&state=YYY
   ↓
5. GET /api/facebook/oauth/callback
   → Échange code contre token
   → Récupère les pages
   → Sauvegarde la configuration
   ↓
6. Redirection vers /pages/modules/facebook-config.php?success=connected
```

## ⚠️ Erreurs courantes

- **"FACEBOOK_APP_ID non configuré"** → Configurez App ID et App Secret dans l'interface
- **"invalid_state"** → Le state a expiré, réessayez
- **"no_pages"** → Votre compte Facebook n'a pas de pages gérées
- **"Erreur lors de l'échange du code"** → Vérifiez App ID, App Secret et URL de redirection dans Facebook
