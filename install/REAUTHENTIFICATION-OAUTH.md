# Réauthentification automatique après OAuth

## Problème

Après la redirection OAuth depuis Facebook, la session PHP est perdue et l'utilisateur est déconnecté de GDRI.

## Solution

Implémentation d'un système de réauthentification automatique via un token temporaire :

1. **Génération du token** : Lors du callback OAuth, un token de réauthentification est généré et sauvegardé dans MongoDB
2. **Transmission dans l'URL** : Le token est passé dans l'URL de redirection vers la page PHP
3. **Réauthentification automatique** : La page PHP vérifie le token et réauthentifie automatiquement l'utilisateur

## Flux

1. Utilisateur clique sur "Se connecter avec Facebook" (connecté à GDRI)
2. Redirection vers Facebook OAuth
3. Facebook redirige vers `/api/facebook/oauth/callback` (Node.js)
4. Node.js génère un token de réauthentification et redirige vers `/frontend/pages/modules/facebook-config.php?reauth=TOKEN`
5. La page PHP vérifie le token et réauthentifie automatiquement l'utilisateur
6. L'utilisateur reste connecté à GDRI

## Sécurité

- Le token expire après 5 minutes
- Le token est supprimé après utilisation
- Le token est unique et aléatoire (32 bytes hex)
- Le token est vérifié dans MongoDB avant utilisation

## Fichiers modifiés

- `backend/modules/facebook/routes.js` : Génération du token dans le callback OAuth
- `frontend/pages/modules/facebook-config.php` : Vérification et réauthentification automatique

## Collection MongoDB

**`facebook_oauth_reauth`** :
```javascript
{
  token: "hex_string",
  userId: ObjectId,
  entrepriseId: ObjectId,
  createdAt: Date,
  expiresAt: Date
}
```
