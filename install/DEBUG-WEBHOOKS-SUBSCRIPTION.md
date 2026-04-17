# Debug des abonnements aux webhooks Facebook

## Problème

Erreur lors de l'abonnement aux webhooks : "Certains webhooks n'ont pas pu être abonnés"

## Causes possibles

### 1. Webhook non configuré dans Facebook Developer
L'API `/subscribed_apps` nécessite que le webhook soit déjà configuré et validé dans Facebook Developer.

**Solution** :
1. Aller dans Facebook Developer → Votre App → Webhooks
2. Ajouter un webhook avec :
   - URL : `https://www.gdr-innovation.fr/api/facebook/webhook`
   - Verify Token : `gdri_facebook_webhook_token_2024`
3. Valider le webhook (Facebook enverra une requête GET)

### 2. Permissions manquantes
Certains webhooks nécessitent des permissions spécifiques :

- **`feed`** : Nécessite `pages_read_engagement` ou `pages_manage_posts`
- **`mentions`** : Nécessite `pages_read_engagement`
- **`messages`** : Nécessite `pages_messaging` (permission avancée)

**Solution** :
1. Aller dans Facebook Developer → Votre App → Produits → Facebook Login → Paramètres
2. Vérifier que les permissions nécessaires sont dans la liste
3. Demander une révision d'app si nécessaire (pour `pages_messaging`)

### 3. Token invalide ou expiré
Le Page Access Token peut être invalide ou expiré.

**Solution** :
1. Vérifier que le token est valide
2. Se reconnecter via OAuth pour obtenir un nouveau token

### 4. Format de l'API incorrect
L'endpoint `/subscribed_apps` peut nécessiter un format différent.

**Vérification** :
- Consulter les logs Node.js pour voir la réponse exacte de Facebook
- Vérifier la documentation Facebook Graph API

## Logs améliorés

Les logs Node.js affichent maintenant :
- Le statut HTTP de la réponse
- La réponse complète de Facebook
- Les codes d'erreur et types d'erreur
- Les détails de chaque tentative d'abonnement

## Vérification

1. **Consulter les logs Node.js** pour voir les erreurs exactes
2. **Vérifier Facebook Developer** :
   - Webhook configuré et validé
   - Permissions accordées
   - App en mode production (ou test avec utilisateurs autorisés)
3. **Tester avec un seul webhook** (feed) pour isoler le problème

## Endpoint utilisé

```
POST /v24.0/{page_id}/subscribed_apps
{
  "subscribed_fields": ["feed", "mentions", "messages"]
}
```

## Documentation Facebook

- [Webhooks Facebook](https://developers.facebook.com/docs/graph-api/webhooks)
- [Subscribed Apps API](https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps)
