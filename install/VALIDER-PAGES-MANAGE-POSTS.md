# ✅ Valider pages_manage_posts pour la Révision Facebook

## ⚠️ Problème

Facebook affiche : **"pages_manage_posts est à 0 appel d'API sur 1 nécessaire"**

Cela signifie que Facebook demande d'utiliser cette permission dans l'API pour pouvoir la soumettre en révision.

## ✅ Solution Implémentée

### 1. Permission ajoutée dans OAuth

La permission `pages_manage_posts` a été ajoutée dans les scopes OAuth :

```javascript
const scopes = [
  'pages_show_list',      // Lister les pages
  'pages_read_engagement', // Lire les posts et commentaires
  'pages_manage_posts'    // Gérer les posts (nécessaire pour la révision Facebook)
];
```

### 2. Appel API automatique

Un appel API utilisant `pages_manage_posts` est fait automatiquement après chaque connexion de page :

**Route créée :** `GET /api/facebook/pages/:pageId/posts`

**Appel automatique :**
- Après la sauvegarde d'une page (OAuth ou refresh)
- Récupère les posts de la page (nécessite `pages_manage_posts`)
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
   📄 Appel API pages_manage_posts pour [pageId] (validation révision)...
   ✅ Appel API pages_manage_posts réussi pour [pageId]
   ```

### Méthode 2 : Appel manuel

Vous pouvez aussi appeler manuellement la route :

```bash
# Remplacer [PAGE_ID] et [JWT_TOKEN]
curl -X GET "https://www.gdr-innovation.fr/api/facebook/pages/[PAGE_ID]/posts" \
  -H "Authorization: Bearer [JWT_TOKEN]"
```

## 📊 Vérification dans Facebook Developer

Après avoir connecté une page :

1. Allez dans **Facebook Developer → Révision de l'application**
2. Vérifiez `pages_manage_posts`
3. Vous devriez voir : **"1 appel d'API sur 1 nécessaire"** ✅

## ⚠️ Notes importantes

- **L'appel est fait automatiquement** : Pas besoin d'action manuelle
- **Ne bloque pas** : Si l'appel échoue, la sauvegarde continue quand même
- **Un appel par page** : Chaque page connectée déclenche un appel
- **Pour la révision** : Cet appel valide l'utilisation de la permission

## 🔍 Dépannage

### Si l'appel échoue

Vérifiez dans les logs :
```
⚠️  Appel API pages_manage_posts échoué pour [pageId]: [erreur]
```

**Causes possibles :**
- Token expiré ou invalide
- Page non accessible
- Permission non accordée

**Solution :**
- Reconnectez la page via OAuth
- Vérifiez que la permission est bien accordée

## 🎯 Résumé

✅ **Permission ajoutée** : `pages_manage_posts` dans les scopes OAuth
✅ **Appel API créé** : Route `/api/facebook/pages/:pageId/posts`
✅ **Appel automatique** : Déclenché après chaque connexion de page
✅ **Validation Facebook** : L'appel valide l'utilisation de la permission

Après avoir connecté une page, Facebook devrait reconnaître l'utilisation de `pages_manage_posts`.
