# Service de Polling Facebook

## 🎯 Objectif

Ce service permet de récupérer les messages et commentaires Facebook via l'API Graph au lieu d'attendre les webhooks. Utile lorsque les webhooks ne fonctionnent pas (mode test, problèmes de connexion, etc.).

## 📋 Prérequis

### 1. Page Access Token

Vous devez obtenir un **Page Access Token** avec les permissions suivantes :
- `pages_read_engagement` : Pour lire les posts et commentaires
- `pages_manage_posts` : Optionnel, pour créer des posts

**Comment l'obtenir :**

1. Allez sur [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Sélectionnez votre **App Facebook**
3. Dans le menu déroulant, sélectionnez votre **Page** (pas votre profil utilisateur)
4. Générez un token avec les permissions nécessaires
5. Copiez le token

### 2. Variables d'environnement

Ajoutez dans votre fichier `.env` ou définissez-les :

```env
FACEBOOK_PAGE_ID=205855939507920
FACEBOOK_PAGE_ACCESS_TOKEN=votre_page_access_token_ici
```

## 🚀 Utilisation

### Méthode 1 : Via l'API REST

**Endpoint :** `POST /api/facebook/pull`

**Body (optionnel) :**
```json
{
  "pageId": "205855939507920",
  "accessToken": "VOTRE_TOKEN",
  "sinceDate": "2026-01-01T00:00:00Z"
}
```

**Exemple avec curl :**
```bash
curl -X POST http://localhost:3000/api/facebook/pull \
  -H "Content-Type: application/json" \
  -d '{
    "pageId": "205855939507920",
    "accessToken": "VOTRE_TOKEN"
  }'
```

**Réponse :**
```json
{
  "success": true,
  "message": "Pull démarré en arrière-plan",
  "pageId": "205855939507920"
}
```

### Méthode 2 : Via le script de test

```bash
# Définir le token
$env:FACEBOOK_PAGE_ACCESS_TOKEN="VOTRE_TOKEN"

# Exécuter le script
node backend/test-facebook-pull.js
```

## 📊 Fonctionnement

### Premier Pull

Lors du **premier pull**, le service récupère tous les messages et commentaires depuis le **01/01/2026**.

### Pulls suivants

Lors des **pulls suivants**, le service récupère uniquement les nouveaux messages et commentaires depuis le dernier pull.

La date du dernier pull est sauvegardée dans MongoDB dans la collection `facebook_polling`.

### Traitement automatique

Les messages et commentaires récupérés sont automatiquement :
1. ✅ Sauvegardés dans MongoDB
2. ✅ Analysés pour détecter l'intention
3. ✅ Notifiés par email si nécessaire

## 🔄 Planification automatique (Optionnel)

Pour automatiser les pulls, vous pouvez utiliser un cron job ou un scheduler :

### Exemple avec node-cron

```javascript
const cron = require('node-cron');
const http = require('http');

// Pull toutes les heures
cron.schedule('0 * * * *', () => {
  // Faire un POST vers /api/facebook/pull
});
```

### Exemple avec Windows Task Scheduler

Créez une tâche planifiée qui exécute :
```powershell
curl.exe -X POST http://localhost:3000/api/facebook/pull -H "Content-Type: application/json" -d "{\"pageId\":\"205855939507920\",\"accessToken\":\"VOTRE_TOKEN\"}"
```

## 📝 Logs

Le service affiche des logs détaillés dans la console :

```
🔄 ===== DÉBUT DU PULL FACEBOOK =====
  ⏰ Timestamp: 2026-02-22T16:00:00.000Z
  📅 Premier pull: depuis le 01/01/2026
  📥 Récupération des posts depuis 2026-01-01T00:00:00.000Z...
  ✅ 5 post(s) récupéré(s)
  💾 Date du dernier pull sauvegardée: 2026-02-22T16:00:00.000Z

✅ Pull terminé:
  📊 5 post(s) traité(s)
  💬 5 message(s) de post
  💬 12 commentaire(s)
  📅 Prochain pull depuis: 2026-02-22T16:00:00.000Z
```

## ⚠️ Limitations

1. **Rate Limiting** : L'API Graph Facebook limite le nombre de requêtes. Le service gère automatiquement la pagination.

2. **Token Expiration** : Les Page Access Tokens peuvent expirer. Vérifiez régulièrement que le token est valide.

3. **Premier Pull** : Le premier pull peut prendre du temps si vous avez beaucoup de posts depuis le 01/01/2026.

## 🔍 Vérification

Après un pull, vérifiez :

1. **Console du serveur** : Les logs de traitement
2. **MongoDB** : Collection `facebook_webhooks` pour voir les messages sauvegardés
3. **MongoDB** : Collection `facebook_polling` pour voir la date du dernier pull
4. **Emails** : Les notifications d'intention détectées

## 🐛 Dépannage

### Erreur "Invalid OAuth access token"

- Vérifiez que le token est valide
- Régénérez un nouveau token dans Graph API Explorer
- Assurez-vous que le token est un **Page Access Token** (pas un User Access Token)

### Erreur "Page ID not found"

- Vérifiez que le Page ID est correct
- Assurez-vous que votre app a accès à la page

### Aucun post récupéré

- Vérifiez que la page a des posts depuis la date spécifiée
- Vérifiez les permissions du token (`pages_read_engagement`)
