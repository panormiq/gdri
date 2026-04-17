# Configuration OAuth Facebook

## 🎯 Objectif

Permet de connecter un compte Facebook via OAuth pour automatiser la récupération du Page Access Token, sans avoir à le saisir manuellement.

## 📋 Prérequis

### 1. Variables d'environnement

Ajoutez dans votre fichier `.env` du backend :

```env
FACEBOOK_APP_ID=votre_app_id
FACEBOOK_APP_SECRET=votre_app_secret
FACEBOOK_REDIRECT_URI=https://www.gdr-innovation.fr/api/facebook/oauth/callback
```

### 2. Configuration dans Facebook Developer

1. Allez dans votre [App Facebook](https://developers.facebook.com/apps/)
2. Allez dans **Paramètres** → **De base**
3. Notez votre **App ID** et **App Secret**
4. Allez dans **Produits** → **Facebook Login** → **Paramètres**
5. Ajoutez l'URL de redirection autorisée :
   ```
   https://www.gdr-innovation.fr/api/facebook/oauth/callback
   ```

### 3. Permissions requises

Dans **Produits** → **Facebook Login** → **Paramètres** → **Autorisations et fonctionnalités**, assurez-vous d'avoir :
- `pages_show_list` : Pour lister les pages de l'utilisateur
- `pages_read_engagement` : Pour lire les posts et commentaires
- `pages_messaging` : Pour les messages privés (optionnel, nécessite révision d'app - voir `install/OBTENIR-PERMISSION-PAGES-MESSAGING.md`)

## 🚀 Utilisation

### Via l'interface web

1. Allez sur la page **Configuration Facebook** (`/pages/modules/facebook-config.php`)
2. Cliquez sur **"Se connecter avec Facebook"**
3. Autorisez l'application dans Facebook
4. Si vous avez plusieurs pages, sélectionnez celle que vous voulez connecter
5. La configuration est automatiquement sauvegardée

### Flux OAuth

1. **GET /api/facebook/oauth/login** : Génère l'URL d'authentification Facebook
2. L'utilisateur est redirigé vers Facebook pour autoriser l'application
3. **GET /api/facebook/oauth/callback** : Reçoit le code d'autorisation
4. Le code est échangé contre un User Access Token
5. Les pages de l'utilisateur sont récupérées
6. Si une seule page : sélection automatique
7. Si plusieurs pages : l'utilisateur choisit
8. **POST /api/facebook/oauth/select-page** : Sauvegarde la page sélectionnée avec son Page Access Token

## 🔒 Sécurité

- Le `state` est utilisé pour sécuriser le callback OAuth
- Le state expire après 10 minutes
- Chaque entreprise a sa propre configuration
- Les tokens sont stockés de manière sécurisée dans MongoDB

## 📊 Structure de données

### Collection `facebook_configs`

```javascript
{
  entrepriseId: "ObjectId",
  pageId: "205855939507920",
  pageAccessToken: "EAAK...",
  pageName: "Nom de la page",
  userAccessToken: "EAAK...", // Optionnel, pour renouveler le token
  updated_at: Date,
  updated_by: "ObjectId"
}
```

### Collection `facebook_oauth_states`

```javascript
{
  state: "base64_encoded_state",
  entrepriseId: "ObjectId",
  userId: "ObjectId",
  userAccessToken: "EAAK...", // Temporaire
  pages: [...], // Temporaire
  createdAt: Date,
  expiresAt: Date
}
```

## 🔄 Renouvellement des tokens

Les tokens Facebook peuvent expirer. Pour renouveler :
1. L'utilisateur doit se reconnecter via OAuth
2. Un nouveau token sera automatiquement récupéré et sauvegardé

## ⚠️ Limitations

- Les tokens ont une durée de vie limitée (généralement 60 jours)
- Il faut se reconnecter périodiquement pour renouveler les tokens
- En mode développement/test, les tokens peuvent avoir des restrictions

## 🐛 Dépannage

### Erreur "FACEBOOK_APP_ID non configuré"
- Vérifiez que `FACEBOOK_APP_ID` est défini dans `.env`

### Erreur "invalid_state"
- Le state a expiré ou est invalide
- Réessayez la connexion OAuth

### Erreur "no_pages"
- L'utilisateur n'a pas de pages Facebook
- L'utilisateur doit créer une page Facebook d'abord

### Erreur lors de l'échange du code
- Vérifiez que `FACEBOOK_APP_SECRET` est correct
- Vérifiez que l'URL de redirection correspond exactement à celle configurée dans Facebook
