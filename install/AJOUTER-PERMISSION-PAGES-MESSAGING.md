# Comment ajouter la permission `pages_messaging` dans Facebook Developer

## 🔍 Pourquoi je ne vois pas `pages_messaging` ?

La permission `pages_messaging` n'apparaît **pas automatiquement** dans la liste des permissions disponibles. Il faut l'**ajouter manuellement**.

## 📋 Étapes pour ajouter la permission

### Étape 1 : Accéder aux permissions

1. Allez sur [Facebook Developers](https://developers.facebook.com/apps/)
2. Sélectionnez votre application
3. Allez dans **Produits** → **Facebook Login** → **Paramètres**
4. Faites défiler jusqu'à la section **"Autorisations et fonctionnalités"**

### Étape 2 : Ajouter la permission

1. Cliquez sur le bouton **"Ajouter une autorisation"** ou **"Add Permission"**
2. Dans le champ de recherche, tapez : `pages_messaging`
3. Si elle n'apparaît pas dans la recherche, essayez :
   - `pages`
   - `messaging`
   - `page messaging`
4. Sélectionnez `pages_messaging` dans les résultats
5. Cliquez sur **"Ajouter"** ou **"Add"**

### Étape 3 : Vérifier l'ajout

La permission `pages_messaging` devrait maintenant apparaître dans la liste des permissions avec le statut :
- **Mode développement** : ✅ Disponible pour les administrateurs/testeurs
- **Mode production** : ⚠️ Nécessite une révision d'app

## 🔍 Si la permission n'apparaît toujours pas

### Option 1 : Vérifier le type d'application

`pages_messaging` est disponible uniquement pour :
- ✅ Applications **Facebook Login**
- ✅ Applications **Messenger**
- ❌ Pas disponible pour certaines autres catégories

### Option 2 : Vérifier les produits activés

Assurez-vous que ces produits sont activés :
1. **Facebook Login** (obligatoire)
2. **Messenger** (recommandé pour messages)

Pour activer Messenger :
1. Allez dans **Produits** → **Messenger**
2. Cliquez sur **"Configurer"** ou **"Set Up"**

### Option 3 : Vérifier dans App Review

Parfois, la permission doit être demandée directement dans App Review :

1. Allez dans **App Review** → **Permissions and Features**
2. Cliquez sur **"Add a Permission"** ou **"Ajouter une permission"**
3. Recherchez `pages_messaging`
4. Cliquez sur **"Request"** ou **"Demander"**

## 📸 Emplacement exact dans l'interface

### Chemin 1 : Via Facebook Login

```
Facebook Developers
  → Votre App
    → Produits
      → Facebook Login
        → Paramètres
          → Autorisations et fonctionnalités
            → [Ajouter une autorisation]
              → Rechercher "pages_messaging"
```

### Chemin 2 : Via App Review

```
Facebook Developers
  → Votre App
    → App Review
      → Permissions and Features
        → [Add a Permission]
          → Rechercher "pages_messaging"
```

## ⚠️ Différence entre "Ajouter" et "Demander"

- **Ajouter** (dans Facebook Login) : Rend la permission disponible pour le développement
- **Demander** (dans App Review) : Soumet une demande de révision pour la production

## 🔄 Après avoir ajouté la permission

### En mode développement

1. La permission est maintenant disponible
2. Les administrateurs/testeurs peuvent l'autoriser lors de l'OAuth
3. Pas besoin de révision pour tester

### Pour la production

1. Allez dans **App Review** → **Permissions and Features**
2. Trouvez `pages_messaging`
3. Cliquez sur **"Request"** ou **"Demander"**
4. Remplissez le formulaire de demande
5. Attendez l'approbation

## 🧪 Tester que la permission est disponible

### Via l'API Graph

```bash
# Vérifier les permissions disponibles pour votre app
curl "https://graph.facebook.com/v24.0/APP-ID/permissions?access_token=APP-ACCESS-TOKEN"
```

### Via OAuth

1. Ajoutez `pages_messaging` aux scopes OAuth dans votre code
2. Lancez le flux OAuth
3. Vérifiez que Facebook demande bien cette permission

## 📝 Code à mettre à jour

Une fois la permission ajoutée dans Facebook Developer, mettez à jour le code :

**Fichier** : `backend/modules/facebook/routes.js`

```javascript
// Permissions nécessaires pour gérer les pages
const scopes = [
  'pages_show_list',      // Lister les pages
  'pages_read_engagement', // Lire les posts et commentaires
  'pages_messaging'       // ⬅️ DÉCOMMENTER CETTE LIGNE
].join(',');
```

## 🐛 Problèmes courants

### "Permission not found"
- Vérifiez que vous avez bien activé **Facebook Login**
- Vérifiez que vous êtes en mode développement (pour tester sans révision)

### "Permission requires app review"
- Normal en mode production
- Soumettez la demande dans App Review

### La permission n'apparaît pas dans la recherche
- Essayez de rechercher juste `messaging`
- Vérifiez que le produit **Messenger** est activé
- Assurez-vous d'être sur la bonne page (Facebook Login → Paramètres)

## 🔗 Documentation Facebook

- [Pages Messaging Permission](https://developers.facebook.com/docs/permissions/reference/pages_messaging)
- [Adding Permissions](https://developers.facebook.com/docs/app-review/permissions)
