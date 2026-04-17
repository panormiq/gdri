# Configuration des Webhooks Facebook

## Fonctionnalité

Interface permettant aux utilisateurs de sélectionner les types de webhooks Facebook auxquels ils souhaitent s'abonner après avoir connecté leur page Facebook.

## Interface

### Webhooks principaux (affichés par défaut)
- **📝 Feed** : Posts et commentaires sur la page
- **🏷️ Mentions** : Mentions de la page dans des posts/commentaires
- **💬 Messages** : Messages privés reçus sur la page

### Webhooks supplémentaires (dans un menu déroulant)
- **Postbacks** : Postbacks de messages
- **Références** : Références de messages
- **Réactions** : Réactions aux messages

## Fonctionnement

1. **Affichage conditionnel** : La section webhook s'affiche uniquement si une page Facebook est connectée
2. **Chargement automatique** : Les webhooks actuellement sélectionnés sont chargés et cochés automatiquement
3. **Sauvegarde** : Lors de l'enregistrement, les webhooks sélectionnés sont :
   - Abonnés automatiquement via l'API Graph Facebook
   - Sauvegardés dans la base de données (collection `facebook_configs`)

## Routes API

### POST `/api/facebook/webhooks/subscribe`
S'abonne aux webhooks sélectionnés pour la page connectée.

**Body** :
```json
{
  "webhooks": ["feed", "mentions", "messages"]
}
```

**Réponse** :
```json
{
  "success": true,
  "message": "Webhooks abonnés avec succès",
  "results": [
    { "event": "feed", "success": true },
    { "event": "mentions", "success": true }
  ],
  "webhooks": ["feed", "mentions"]
}
```

### GET `/api/facebook/webhooks/subscribed`
Récupère les webhooks actuellement abonnés pour la page connectée.

**Réponse** :
```json
{
  "success": true,
  "webhooks": ["feed", "mentions"]
}
```

## Base de données

Les préférences de webhooks sont sauvegardées dans la collection `facebook_configs` :

```javascript
{
  entrepriseId: ObjectId,
  pageId: "205855939507920",
  pageAccessToken: "EAAK...",
  webhooks_subscribed: ["feed", "mentions", "messages"],
  webhooks_updated_at: Date
}
```

## Service utilisé

`WebhookSubscriptionService` : Service qui gère l'abonnement aux webhooks via l'API Graph Facebook.

## Fichiers modifiés

- `frontend/pages/modules/facebook-config.php` : Interface avec checkboxes
- `backend/modules/facebook/routes.js` : Routes API pour l'abonnement et la récupération
