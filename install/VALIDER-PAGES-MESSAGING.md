# ✅ Valider pages_messaging pour la Révision Facebook

## ⚠️ Problème

Facebook affiche : **"pages_messaging est à 0 appel d'API sur 1 nécessaire"**

Cela signifie que Facebook demande d'utiliser cette permission dans l'API pour pouvoir la soumettre en révision.

## ✅ Solution Implémentée

### 1. Permission ajoutée dans OAuth

La permission `pages_messaging` a été ajoutée dans les scopes OAuth :

```javascript
const scopes = [
  'pages_show_list',      // Lister les pages
  'pages_read_engagement', // Lire les posts et commentaires
  'pages_manage_posts',    // Gérer les posts
  'pages_messaging'        // Messages privés (nécessaire pour la révision Facebook)
];
```

### 2. Appel API automatique

Un appel API utilisant `pages_messaging` est fait automatiquement après chaque connexion de page :

**Route créée :** `GET /api/facebook/pages/:pageId/conversations`

**Appel automatique :**
- Après la sauvegarde d'une page (OAuth ou refresh)
- Récupère les conversations de la page (nécessite `pages_messaging`)
- Valide l'utilisation de la permission pour Facebook

### 3. Quand l'appel est fait

L'appel API est déclenché automatiquement :
- ✅ Après la connexion OAuth d'une page
- ✅ Après la sauvegarde de plusieurs pages
- ✅ En arrière-plan (ne bloque pas l'interface)

## 🧪 Comment tester

### Méthode 1 : Connexion d'une nouvelle page

1. Connectez une nouvelle page Facebook via OAuth
2. Vérifiez les logs Node.js :
   ```
   💬 Appel API pages_messaging pour [pageId] (validation révision)...
   ✅ Appel API pages_messaging réussi pour [pageId]
   ```

### Méthode 2 : Appel manuel

Vous pouvez aussi appeler manuellement la route :

```bash
# Remplacer [PAGE_ID] et [JWT_TOKEN]
curl -X GET "https://www.gdr-innovation.fr/api/facebook/pages/[PAGE_ID]/conversations" \
  -H "Authorization: Bearer [JWT_TOKEN]"
```

## 📊 Vérification dans Facebook Developer

Après avoir connecté une page :

1. Allez dans **Facebook Developer → Révision de l'application**
2. Vérifiez `pages_messaging`
3. Vous devriez voir : **"1 appel d'API sur 1 nécessaire"** ✅

## ⚠️ Notes importantes

- **L'appel est fait automatiquement** : Pas besoin d'action manuelle
- **Ne bloque pas** : Si l'appel échoue, la sauvegarde continue quand même
- **Un appel par page** : Chaque page connectée déclenche un appel
- **Pour la révision** : Cet appel valide l'utilisation de la permission
- **Permission avancée** : `pages_messaging` nécessite une révision d'app par Facebook

## 🔍 Dépannage

### Si l'appel échoue

Vérifiez dans les logs :
```
⚠️  Appel API pages_messaging échoué pour [pageId]: [erreur]
💡 Si la permission n'est pas encore approuvée, c'est normal.
```

**Causes possibles :**
- Permission non encore approuvée par Facebook (normal si en attente de révision)
- Token expiré ou invalide
- Page non accessible
- Permission non accordée lors de l'OAuth

**Solutions :**
- Si la permission n'est pas encore approuvée : C'est normal, l'appel sera fait automatiquement après approbation
- Si le token est expiré : Reconnectez la page via OAuth
- Si la permission n'est pas accordée : Vérifiez que `pages_messaging` est bien dans les scopes OAuth

**Erreur « User associated with the Page access token does not have an appropriate role on the Page » :**
- Le compte Facebook qui a connecté la page n'a pas un rôle suffisant sur la Page. Il faut être **Administrateur** ou **Éditeur** de la Page pour que le token ait accès aux messages.
- À faire : sur Facebook, aller dans Paramètres de la Page → Rôles de la Page, et attribuer au compte le rôle Admin ou Éditeur.

## 🎯 Résumé

✅ **Permission ajoutée** : `pages_messaging` dans les scopes OAuth
✅ **Appel API créé** : Route `/api/facebook/pages/:pageId/conversations`
✅ **Appel automatique** : Déclenché après chaque connexion de page
✅ **Validation Facebook** : L'appel valide l'utilisation de la permission

Après avoir connecté une page, Facebook devrait reconnaître l'utilisation de `pages_messaging`.

## 📝 Note sur la Révision

`pages_messaging` est une **permission avancée** qui nécessite :
1. Une révision d'app par Facebook
2. Une justification de l'utilisation
3. Une vidéo de démonstration (recommandé)

Consultez `install/OBTENIR-PERMISSION-PAGES-MESSAGING.md` pour plus de détails.
