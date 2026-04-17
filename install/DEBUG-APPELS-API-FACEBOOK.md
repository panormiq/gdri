# 🔍 Déboguer les appels API Facebook

## ⚠️ Problème

Facebook affiche toujours "0 appel d'API sur 1 nécessaire" pour `pages_manage_posts` et `pages_messaging`.

## 🔍 Vérifications à faire

### 1. Vérifier que les appels sont bien exécutés

Regardez les logs Node.js après avoir :
- Connecté une nouvelle page
- Cliqué sur "Valider les permissions" dans le panel d'administration

Vous devriez voir :
```
📄 ===== APPEL API pages_manage_posts =====
   Page ID: [pageId]
   URL: https://graph.facebook.com/v24.0/[pageId]/posts?...
   Méthode: GET
   Permission requise: pages_manage_posts
   ✅ Réponse reçue: {...}
✅ Appel API pages_manage_posts réussi pour [pageId]
```

### 2. Vérifier que le token a les bonnes permissions

Le token utilisé doit être un **Page Access Token** (pas un User Access Token) et doit avoir les permissions demandées.

Pour vérifier les permissions d'un token :
```bash
curl "https://graph.facebook.com/v24.0/me/permissions?access_token=PAGE_ACCESS_TOKEN"
```

Vous devriez voir `pages_manage_posts` et `pages_messaging` dans la liste.

### 3. Vérifier que l'app est en mode production

⚠️ **Important** : Facebook peut ne pas compter les appels API en mode **développement**.

Pour que Facebook compte les appels :
1. L'app doit être en mode **production** (pas développement)
2. Ou l'app doit être soumise en révision (même si pas encore approuvée)

### 4. Vérifier le délai de mise à jour

Facebook peut prendre **plusieurs heures** pour mettre à jour les statistiques d'appels API.

Attendez 24 heures après avoir fait les appels, puis vérifiez à nouveau dans Facebook Developer.

### 5. Tester manuellement avec curl

Pour vérifier que les appels fonctionnent :

```bash
# Test pages_manage_posts
curl "https://graph.facebook.com/v24.0/PAGE-ID/posts?access_token=PAGE-ACCESS-TOKEN&fields=id,message,created_time&limit=1"

# Test pages_messaging
curl "https://graph.facebook.com/v24.0/PAGE-ID/conversations?access_token=PAGE-ACCESS-TOKEN&fields=id,updated_time&limit=1"
```

Si ces appels fonctionnent, Facebook devrait les compter.

## 🛠️ Solutions

### Solution 1 : Forcer les appels depuis le panel admin

1. Allez dans le panel d'administration → Configuration Application Facebook
2. Cliquez sur "Valider les permissions pour toutes les pages connectées"
3. Vérifiez les logs Node.js pour confirmer que les appels sont faits
4. Attendez 24 heures
5. Vérifiez dans Facebook Developer → Révision de l'application

### Solution 2 : Vérifier que l'app est en production

1. Allez sur [Facebook Developers](https://developers.facebook.com/apps/)
2. Sélectionnez votre application
3. Vérifiez le mode de l'application (développement vs production)
4. Si en développement, passez en production ou soumettez l'app en révision

### Solution 3 : Vérifier les permissions du token

1. Utilisez le Graph API Explorer pour vérifier les permissions :
   - Allez sur [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
   - Sélectionnez votre app
   - Sélectionnez votre page (pas votre profil utilisateur)
   - Générez un token avec `pages_manage_posts` et `pages_messaging`
   - Testez les appels API

## 📝 Notes importantes

- Les appels doivent être faits avec un **Page Access Token**, pas un User Access Token
- Les appels doivent utiliser la méthode **GET** (pas POST)
- Facebook peut prendre jusqu'à 24 heures pour mettre à jour les statistiques
- En mode développement, Facebook peut ne pas compter tous les appels

## 🔗 Documentation Facebook

- [Page Access Tokens](https://developers.facebook.com/docs/pages/access-tokens)
- [App Review](https://developers.facebook.com/docs/app-review)
