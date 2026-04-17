# Comment obtenir la permission `pages_messaging`

## ⚠️ Permission avancée

La permission `pages_messaging` est une **permission avancée** qui nécessite une **révision d'application** par Facebook. Elle permet d'accéder aux messages privés des pages Facebook.

## 📋 Étapes pour obtenir la permission

### Étape 1 : Ajouter la permission dans Facebook Developer

⚠️ **Important** : La permission `pages_messaging` n'apparaît **pas automatiquement** dans la liste. Il faut l'ajouter manuellement.

1. Allez sur [Facebook Developers](https://developers.facebook.com/apps/)
2. Sélectionnez votre application
3. Allez dans **Produits** → **Facebook Login** → **Paramètres**
4. Dans la section **"Autorisations et fonctionnalités"**, cliquez sur **"Ajouter une autorisation"** ou **"Add Permission"**
5. Dans le champ de recherche, tapez : `pages_messaging`
   - Si elle n'apparaît pas, essayez de rechercher juste `messaging` ou `pages`
6. Sélectionnez `pages_messaging` et cliquez sur **"Ajouter"**

**Si la permission n'apparaît toujours pas** :
- Vérifiez que le produit **Messenger** est activé (Produits → Messenger → Configurer)
- Essayez d'ajouter la permission via **App Review** → **Permissions and Features** → **Add a Permission**

📖 **Guide détaillé** : Voir `install/AJOUTER-PERMISSION-PAGES-MESSAGING.md`

### Étape 2 : Soumettre l'application pour révision

⚠️ **Important** : Facebook doit approuver votre utilisation de cette permission.

1. Allez dans **App Review** → **Permissions and Features**
2. Trouvez `pages_messaging` dans la liste
3. Cliquez sur **"Request"** ou **"Demander"**
4. Remplissez le formulaire de demande :
   - **Comment cette application utilisera-t-elle pages_messaging ?** : Utilisez le texte et les instructions détaillées du guide **`install/REVISION-PAGES-MESSAGING-TEXTE-ET-VIDEO.md`** (justification prête à coller, instructions pour les réviseurs, script pour la vidéo).
   - **Instructions** : Copiez les « Instructions de test » du même guide.
   - **Screenshots/Vidéo** : Enregistrez la vidéo en suivant le script du guide (connexion → lecture des messages → envoi d’une réponse).
5. Soumettez la demande

### Étape 3 : Attendre l'approbation

- Facebook peut prendre **plusieurs jours à plusieurs semaines** pour examiner votre demande
- Vous recevrez une notification par email une fois la décision prise
- Si approuvé, la permission sera disponible pour tous les utilisateurs

### Étape 4 : Mettre à jour les scopes OAuth dans le code

Une fois la permission approuvée, mettez à jour le code pour inclure `pages_messaging` dans les scopes OAuth :

**Fichier** : `backend/modules/facebook/routes.js`

```javascript
// Permissions nécessaires pour gérer les pages
const scopes = [
  'pages_show_list',      // Lister les pages
  'pages_read_engagement', // Lire les posts et commentaires
  'pages_messaging'       // ⬅️ AJOUTER CETTE LIGNE (une fois approuvé)
].join(',');
```

## 🔄 Alternative : Mode développement

En **mode développement**, vous pouvez tester `pages_messaging` avec :
- Les administrateurs de l'application
- Les développeurs de l'application
- Les testeurs ajoutés dans **Roles** → **Test Users**

**Limitation** : En mode développement, seuls ces utilisateurs peuvent autoriser la permission.

### Tester l'abonnement avec curl (sans révision)

Une fois que vous avez un Page Access Token avec `pages_messaging` (en mode dev), vous pouvez tester l'abonnement directement :

```bash
curl -i -X POST "https://graph.facebook.com/v24.0/PAGE-ID/subscribed_apps?subscribed_fields=messages&access_token=PAGE-ACCESS-TOKEN"
```

**Note importante** : L'abonnement webhook via API fonctionne **si le token a déjà la permission**. Vous n'avez pas besoin de révision supplémentaire pour l'abonnement, seulement pour obtenir le token avec la permission.

Voir le guide complet : `install/TEST-WEBHOOKS-AVEC-CURL.md`

## 📝 Use Case recommandé pour la révision

**Titre** : Gestion centralisée des messages Facebook pour entreprises

**Description** :
Notre application permet aux entreprises de centraliser la gestion de leurs communications Facebook. Les entreprises peuvent :
- Recevoir des notifications en temps réel des messages privés
- Analyser l'intention des messages via IA
- Répondre aux messages depuis une interface unique
- Gérer plusieurs pages Facebook depuis un seul tableau de bord

**Instructions de test** :
1. Connectez-vous à notre application
2. Connectez votre page Facebook via OAuth
3. Envoyez un message privé à votre page Facebook
4. Vérifiez que le message apparaît dans notre interface
5. Répondez au message depuis notre interface

## ⚠️ Important

- **Ne demandez pas cette permission** si vous n'en avez pas vraiment besoin
- Facebook peut **refuser** la demande si l'utilisation n'est pas claire
- Une fois approuvée, vous devez **respecter les politiques Facebook** concernant les messages

## 📄 Révision : texte et vidéo

Pour remplir le formulaire de révision (question « Comment cette application utilisera-t-elle pages_messaging ? », instructions de test, vidéo), tout est regroupé dans :

- **`install/REVISION-PAGES-MESSAGING-TEXTE-ET-VIDEO.md`** — texte à coller, checklist de vérifications, script pour la vidéo de démonstration.

## 🔗 Documentation Facebook

- [Permissions Facebook](https://developers.facebook.com/docs/permissions/reference)
- [pages_messaging Permission](https://developers.facebook.com/docs/permissions/reference/pages_messaging)
- [App Review Process](https://developers.facebook.com/docs/app-review)
