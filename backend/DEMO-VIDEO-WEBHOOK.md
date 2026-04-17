# Guide pour Démonstration Vidéo - Webhook Facebook

## 🎬 Objectif

Créer un événement réel sur Facebook qui déclenchera un webhook pour la démonstration vidéo.

## ✅ Ce qui fonctionne

- **"Groupe feed"** : Les webhooks fonctionnent pour les groupes
- **"Feed"** : Les webhooks fonctionnent pour les pages, mais le bouton "Test" de Facebook ne renvoie pas de vraies données

## 🚀 Solution : Créer un événement réel

Pour la vidéo, il faut créer un **vrai événement** (post ou commentaire) qui déclenchera un webhook avec de vraies données.

### Méthode 1 : Script automatique (Recommandé)

```powershell
# 1. Définir le Page Access Token
$env:FACEBOOK_PAGE_ACCESS_TOKEN="VOTRE_PAGE_ACCESS_TOKEN"

# 2. Optionnel : Définir le Page ID (par défaut: 205855939507920)
$env:FACEBOOK_PAGE_ID="205855939507920"

# 3. Exécuter le script
node backend/create-test-event.js
```

Le script va :
1. Créer un post de test sur votre page Facebook
2. Facebook détectera l'événement
3. Facebook enverra un webhook "feed" vers votre serveur
4. Votre serveur GDRI recevra et traitera le webhook

### Méthode 2 : Via Graph API Explorer

1. Allez sur : https://developers.facebook.com/tools/explorer/
2. Sélectionnez votre app
3. Sélectionnez votre page dans "Page Access Token"
4. Créez un post :
   ```
   POST /{PAGE_ID}/feed
   message=Test webhook pour démonstration vidéo
   ```
5. Cliquez sur "Submit"

### Méthode 3 : Manuellement sur Facebook

1. Allez sur votre page Facebook
2. Créez un post de test
3. Ou commentez sur un post existant
4. Le webhook sera automatiquement déclenché

## 📊 Ce qui se passe dans la vidéo

1. **Avant** : Le serveur GDRI écoute les webhooks
2. **Action** : Création d'un post/commentaire sur Facebook
3. **Résultat** : 
   - Facebook envoie un webhook POST vers `/api/facebook/webhook`
   - Le serveur GDRI reçoit l'événement
   - Les logs s'affichent dans la console
   - L'événement est traité et analysé

## 🔍 Vérification

Après avoir créé l'événement, vérifiez dans la console du serveur GDRI :

```
🔔🔔🔔 ===== WEBHOOK POST RECU =====
  📥 Method: POST
  📥 URL: /api/facebook/webhook
  📦 Body reçu: { object: 'page', entry: [...] }
```

## ⚠️ Important pour la vidéo

- **Préparez le script à l'avance** : Testez-le avant la vidéo
- **Ayez le Page Access Token prêt** : Ne le montrez pas dans la vidéo (sécurité)
- **Montrez les logs en temps réel** : Ouvrez la console du serveur avant de créer l'événement
- **Expliquez** : "On crée un événement réel, Facebook envoie automatiquement un webhook"

## 🎯 Script de démonstration

Le script `create-test-event.js` est optimisé pour la démonstration :
- Messages clairs et visuels
- Gestion d'erreurs explicite
- Instructions si la configuration manque
