# Interface Onglets pour Configuration Webhooks par Page

## Fonctionnalité

Interface avec onglets permettant de sélectionner les webhooks à suivre pour chaque page Facebook connectée.

## Structure

### Une seule page connectée
- Pas d'onglets affichés
- Formulaire de webhooks directement visible
- Titre : "Événements disponibles"

### Plusieurs pages connectées
- Onglets affichés (un par page)
- Chaque onglet affiche le nom de la page
- Formulaire de webhooks par onglet
- Titre : "Événements pour [Nom de la page]"

## Webhooks disponibles

### Principaux
- **📝 Feed** : Posts et commentaires sur la page
- **🏷️ Mentions** : Mentions de la page dans des posts/commentaires
- **💬 Messages** : Messages privés (nécessite `pages_messaging`)

## Fonctionnement

1. **Chargement** : Les pages connectées sont récupérées via `GET /api/facebook/config`
2. **Génération des onglets** : Un onglet est créé pour chaque page
3. **Formulaire par page** : Chaque onglet contient son propre formulaire de webhooks
4. **Sauvegarde** : Les webhooks sont sauvegardés par `pageId` dans la base de données

## API Modifiée

### GET `/api/facebook/config`
Retourne maintenant :
```json
{
  "success": true,
  "data": { "pageId": "...", "pageName": "...", ... },
  "pages": [
    { "pageId": "...", "pageName": "...", "webhooks_subscribed": [...] },
    ...
  ]
}
```

### POST `/api/facebook/webhooks/subscribe`
Accepte maintenant `pageId` dans le body :
```json
{
  "webhooks": ["feed", "mention"],
  "pageId": "205855939507920"
}
```

### GET `/api/facebook/webhooks/subscribed?pageId=...`
Récupère les webhooks pour une page spécifique.

## Base de données

La structure supporte maintenant plusieurs pages par entreprise :
- Clé unique : `{ entrepriseId, pageId }`
- Chaque page a ses propres `webhooks_subscribed`

## Fichiers modifiés

- `frontend/pages/modules/facebook-config.php` : Interface avec onglets
- `backend/modules/facebook/routes.js` : API modifiée pour supporter plusieurs pages
