# Explication : Pourquoi le test fonctionne mais pas les événements

## 🔍 Différence entre GET (test) et POST (événements)

### 1. **GET /webhook - Test de vérification** ✅
- **Quand** : Facebook envoie cette requête UNE FOIS lors de la configuration du webhook
- **Objectif** : Vérifier que votre serveur répond correctement
- **Paramètres** : `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`
- **Réponse attendue** : Renvoyer le `challenge` reçu
- **Résultat** : Si vous renvoyez le challenge → Facebook considère le webhook comme "valide"

**C'est pourquoi le test retourne "succès"** ✅

### 2. **POST /webhook - Événements réels** 📨
- **Quand** : Facebook envoie cette requête QUAND un événement se produit
- **Objectif** : Vous notifier d'un événement (post, commentaire, mention, etc.)
- **Conditions** :
  - Le webhook doit être **abonné** aux événements
  - Les **permissions** doivent être accordées
  - Un **événement réel** doit se produire
- **Résultat** : Si ces conditions ne sont pas remplies → Aucun POST n'est envoyé

## ⚠️ Pourquoi le test réussit mais pas les POST ?

### Raison 1 : Le webhook n'est pas abonné aux événements
- Le test (GET) vérifie juste que le serveur répond
- Mais Facebook n'envoie des POST que si le webhook est **abonné** aux événements
- **Vérification** : Dans Facebook Developer, allez dans "Webhooks" → Vérifiez que les événements sont "abonnés" (bouton vert)

### Raison 2 : Les permissions ne sont pas accordées
- Facebook nécessite des **permissions spécifiques** pour chaque type d'événement
- Pour "feed" : besoin de `pages_read_engagement` ou `pages_manage_posts`
- **Vérification** : Dans Facebook Developer → "Permissions" → Vérifiez que les permissions sont accordées

### Raison 3 : Aucun événement réel ne s'est produit
- Facebook n'envoie des POST que quand quelque chose se passe **réellement**
- Le test (GET) est juste une vérification, pas un événement réel
- **Solution** : Créez un post sur votre page Facebook pour déclencher un événement

### Raison 4 : Le webhook est configuré mais pas activé
- Le test peut réussir mais le webhook peut être "inactif"
- **Vérification** : Dans Facebook Developer → "Webhooks" → Vérifiez le statut (actif/inactif)

## 🔧 Comment vérifier et corriger

### Étape 1 : Vérifier l'abonnement
1. Allez dans Facebook Developer Console
2. Sélectionnez votre App
3. Allez dans "Webhooks"
4. Vérifiez que le webhook est "Abonné" (vert) et non "Non abonné" (gris)

### Étape 2 : Vérifier les permissions
1. Dans Facebook Developer → "Permissions"
2. Vérifiez que vous avez :
   - `pages_read_engagement` (pour lire les posts)
   - `pages_manage_posts` (pour gérer les posts)
   - `pages_read_user_content` (pour lire les commentaires)

### Étape 3 : Tester avec un événement réel
1. Créez un post sur votre page Facebook
2. Ou commentez un post existant
3. Vérifiez la console GDRI - vous devriez voir :
   ```
   🌐 ===== REQUÊTE WEBHOOK DÉTECTÉE =====
   🔔🔔🔔 ===== WEBHOOK POST RECU =====
   ```

### Étape 4 : Vérifier l'URL du webhook
- L'URL doit être : `https://votre-domaine.com/api/facebook/webhook`
- Vérifiez que l'URL est accessible depuis Internet (pas localhost)
- Utilisez un service comme ngrok si vous testez en local

## 📊 Résumé

| Type | Quand | Objectif | Pourquoi ça marche |
|------|-------|----------|-------------------|
| **GET** | Configuration | Vérifier le serveur | ✅ Toujours fonctionne si le serveur répond |
| **POST** | Événement réel | Notifier un événement | ❌ Nécessite abonnement + permissions + événement réel |

**Conclusion** : Le test (GET) réussit car il vérifie juste que le serveur répond. Les POST ne viennent que si le webhook est correctement configuré ET qu'un événement réel se produit.
