# Tester l'abonnement aux webhooks avec curl

## ✅ Oui, on peut utiliser curl directement !

L'abonnement aux webhooks peut être fait directement via l'API Graph Facebook avec curl, **sans passer par la révision d'app** pour tester.

## ⚠️ Prérequis importants

1. **Le webhook doit être configuré** dans Facebook Developer :
   - URL : `https://www.gdr-innovation.fr/api/facebook/webhook`
   - Verify Token : `gdri_facebook_webhook_token_2024`
   - Le webhook doit être validé (GET request réussie)

2. **Le Page Access Token doit avoir les permissions** :
   - Pour `feed` et `mention` : `pages_read_engagement` (basique)
   - Pour `messages` : `pages_messaging` (avancée)
     - En **mode développement** : fonctionne avec admin/testeur sans révision
     - En **mode production** : nécessite révision d'app

## 📋 Commandes curl

### 1. S'abonner à un webhook (feed)

```bash
curl -i -X POST "https://graph.facebook.com/v24.0/PAGE-ID/subscribed_apps?subscribed_fields=feed&access_token=PAGE-ACCESS-TOKEN"
```

**Exemple :**
```bash
curl -i -X POST "https://graph.facebook.com/v24.0/205855939507920/subscribed_apps?subscribed_fields=feed&access_token=EAAK1paGqmBwBQ0MUKhZAfqNFCGr6rkNjUrWt0Xk51WQuLjhu2ZCGLj1HThDaVXmt2yE9xoT7sXJDptSZCZCgy9TXj2MopNmWT9iU8MNQtkGDWyRJ44XKGA4tuYYTUVNEejuXRgpoBvDuHtOxrTbQSGhrOH9y4G3qhjAQo2XlH8EIceiYt7AppjRV792ZBqZCl62HhDrR70AuP45GeWsTNFlZCFemVkd3C3VPgLkapYZD"
```

### 2. S'abonner à plusieurs webhooks

```bash
curl -i -X POST "https://graph.facebook.com/v24.0/PAGE-ID/subscribed_apps" \
  -H "Content-Type: application/json" \
  -d '{"subscribed_fields":["feed","mention"]}' \
  -d "access_token=PAGE-ACCESS-TOKEN"
```

**Ou avec query string :**
```bash
curl -i -X POST "https://graph.facebook.com/v24.0/PAGE-ID/subscribed_apps?subscribed_fields=feed,mention&access_token=PAGE-ACCESS-TOKEN"
```

### 3. S'abonner à messages (nécessite pages_messaging)

```bash
curl -i -X POST "https://graph.facebook.com/v24.0/PAGE-ID/subscribed_apps?subscribed_fields=messages&access_token=PAGE-ACCESS-TOKEN"
```

⚠️ **Note** : Cette commande fonctionnera **seulement si** :
- Le Page Access Token a la permission `pages_messaging`
- En mode développement : si vous êtes admin/testeur de l'app
- En mode production : si l'app a été approuvée pour `pages_messaging`

### 4. Vérifier les abonnements actuels

```bash
curl "https://graph.facebook.com/v24.0/PAGE-ID/subscribed_apps?access_token=PAGE-ACCESS-TOKEN"
```

**Réponse attendue :**
```json
{
  "data": [
    {
      "category": "FEED",
      "name": "feed",
      "subscribed_fields": ["feed"]
    },
    {
      "category": "MENTION",
      "name": "mention",
      "subscribed_fields": ["mention"]
    }
  ]
}
```

## 🔍 Vérifier les permissions du token

Pour vérifier si votre Page Access Token a la permission `pages_messaging` :

```bash
curl "https://graph.facebook.com/v24.0/me/permissions?access_token=PAGE-ACCESS-TOKEN"
```

**Réponse attendue :**
```json
{
  "data": [
    {
      "permission": "pages_read_engagement",
      "status": "granted"
    },
    {
      "permission": "pages_messaging",
      "status": "granted"
    }
  ]
}
```

## 🎯 Différence importante

### Permission OAuth vs Abonnement Webhook

1. **Permission OAuth (`pages_messaging`)** :
   - Nécessaire pour **obtenir** un token avec cette permission
   - En production : nécessite révision d'app
   - En développement : fonctionne avec admin/testeur

2. **Abonnement webhook (`/subscribed_apps`)** :
   - Peut être fait via API **si on a déjà le token** avec la permission
   - Ne nécessite **pas de révision supplémentaire**
   - Fonctionne tant que le token a la permission

## 💡 Stratégie de test

### En mode développement

1. **Obtenez un Page Access Token** avec `pages_messaging` :
   - Connectez-vous via OAuth en tant qu'admin/testeur
   - Le token aura automatiquement `pages_messaging` (sans révision)

2. **Testez l'abonnement avec curl** :
   ```bash
   curl -i -X POST "https://graph.facebook.com/v24.0/PAGE-ID/subscribed_apps?subscribed_fields=messages&access_token=VOTRE-TOKEN"
   ```

3. **Vérifiez que ça fonctionne** :
   - Envoyez un message privé à la page
   - Vérifiez que le webhook est reçu

### En mode production

1. **Soumettez l'app pour révision** pour `pages_messaging`
2. **Attendez l'approbation**
3. **Une fois approuvé** :
   - Les utilisateurs pourront autoriser `pages_messaging` lors de l'OAuth
   - Vous pourrez vous abonner à `messages` via l'API

## 🚀 Utilisation dans notre code

Notre service `WebhookSubscriptionService` fait exactement ça :

```javascript
// backend/modules/facebook/services/WebhookSubscriptionService.js
const postData = JSON.stringify({
  subscribed_fields: [event]  // ex: ['messages']
});

const path = `/${this.graphApiVersion}/${pageId}/subscribed_apps?access_token=${pageAccessToken}`;
// POST vers https://graph.facebook.com/v24.0/PAGE-ID/subscribed_apps
```

## 📝 Exemple complet PowerShell

```powershell
$pageId = "205855939507920"
$pageToken = "VOTRE-PAGE-ACCESS-TOKEN"

# S'abonner à feed
Invoke-WebRequest -Uri "https://graph.facebook.com/v24.0/$pageId/subscribed_apps?subscribed_fields=feed&access_token=$pageToken" -Method POST

# S'abonner à messages (si token a pages_messaging)
Invoke-WebRequest -Uri "https://graph.facebook.com/v24.0/$pageId/subscribed_apps?subscribed_fields=messages&access_token=$pageToken" -Method POST

# Vérifier les abonnements
Invoke-WebRequest -Uri "https://graph.facebook.com/v24.0/$pageId/subscribed_apps?access_token=$pageToken" | Select-Object -ExpandProperty Content
```

## ⚠️ Erreurs courantes

### Erreur 403 : Permission refusée
```
{
  "error": {
    "message": "To subscribe to the messages field, one of these permissions is needed: pages_messaging",
    "type": "OAuthException",
    "code": 200
  }
}
```

**Solution** : Le Page Access Token n'a pas la permission `pages_messaging`. En mode développement, reconnectez-vous via OAuth en tant qu'admin/testeur.

### Erreur 400 : Webhook non configuré
```
{
  "error": {
    "message": "Invalid webhook URL",
    "type": "OAuthException"
  }
}
```

**Solution** : Configurez d'abord le webhook dans Facebook Developer → Webhooks.

## 🔗 Documentation Facebook

- [Subscribed Apps API](https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps)
- [Webhooks Setup](https://developers.facebook.com/docs/graph-api/webhooks/getting-started)
