# Debug : Problème de connexion OAuth Facebook

## 🔍 Problème signalé

Après avoir cliqué sur "Associer" dans Facebook, la redirection vers GDRI ne fonctionne pas - l'utilisateur n'est plus connecté.

## ✅ Ce qui a été corrigé

1. **Sauvegarde automatique pour une seule page** : Restaurée
2. **Réauthentification** : Améliorée pour restaurer l'entrepriseId
3. **Expiration du token** : Corrigée dans la requête MongoDB

## 🧪 Tests à faire

### 1. Vérifier les logs Node.js

Regardez la console Node.js lors de la connexion OAuth. Vous devriez voir :

```
🔐 ===== OAUTH LOGIN FACEBOOK =====
✅ URL OAuth Facebook générée
🔔🔔🔔 ===== WEBHOOK GET (VERIFICATION) RECU =====
✅ Token reçu, récupération des pages...
✅ X page(s) trouvée(s)
```

### 2. Vérifier la réauthentification

Dans `facebook-config.php`, le code de réauthentification devrait :
1. Trouver le token `reauth` dans l'URL
2. Récupérer le document dans `facebook_oauth_reauth`
3. Restaurer la session PHP avec `user_id`, `entrepriseId`, etc.

### 3. Vérifier le state OAuth

Le state doit contenir :
- `entrepriseId`
- `userId`
- `timestamp`

Et être sauvegardé dans `facebook_oauth_states` avec une expiration de 10 minutes.

## 🔧 Corrections apportées

### Backend (`routes.js`)

1. **Une seule page** : Sauvegarde automatique restaurée
2. **Plusieurs pages** : Redirection vers `configure_pages` avec onglets
3. **Token de réauthentification** : Durée augmentée à 10 minutes

### Frontend (`facebook-config.php`)

1. **Réauthentification** : Restaure maintenant `entrepriseId` depuis le token
2. **Expiration MongoDB** : Corrigée pour utiliser `UTCDateTime()` correctement

## 🐛 Problèmes possibles

### 1. Le state expire trop vite

**Solution** : Vérifier que `expiresAt` est bien défini à `Date.now() + 10 * 60 * 1000`

### 2. La réauthentification ne fonctionne pas

**Solution** : Vérifier que :
- Le token `reauth` est bien dans l'URL
- Le document existe dans `facebook_oauth_reauth`
- L'expiration n'est pas dépassée

### 3. L'entrepriseId n'est pas restauré

**Solution** : Vérifier que `entrepriseId` est bien sauvegardé dans le token de réauthentification

## 📝 Logs à vérifier

### Node.js (Backend)

```javascript
// Lors du callback OAuth
console.log('✅ Token reçu, récupération des pages...');
console.log(`✅ ${pages.length} page(s) trouvée(s)`);
```

### PHP (Frontend)

Vérifier que la réauthentification fonctionne :
- Le token `reauth` est présent dans l'URL
- Le document est trouvé dans MongoDB
- La session est restaurée

## 🔄 Flux attendu

1. **OAuth Login** → Génère state et URL Facebook
2. **Facebook** → Utilisateur autorise l'app
3. **Callback** → Reçoit code et state
4. **Récupération pages** → Obtient toutes les pages
5. **Si 1 page** → Sauvegarde automatique + redirection avec `reauth` token
6. **Si plusieurs pages** → Redirection vers `configure_pages` avec `reauth` token
7. **Réauthentification PHP** → Restaure la session depuis le token `reauth`
8. **Affichage** → Page de configuration avec pages connectées

## 💡 Si ça ne fonctionne toujours pas

1. Vérifier les logs Node.js pour voir où ça bloque
2. Vérifier les logs Apache pour voir les requêtes
3. Vérifier MongoDB pour voir si les documents sont créés
4. Tester avec une seule page d'abord
