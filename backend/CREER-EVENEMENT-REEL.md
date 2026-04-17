# Créer un Événement Réel pour Déclencher un Webhook

## 🎯 Objectif

Pour recevoir un **vrai webhook** avec des données réelles (pas juste le format `sample`), vous devez créer un événement réel sur votre page Facebook via l'API Graph.

## 📋 Prérequis

1. **Page Access Token** : Token d'accès de votre page Facebook
   - Obtenez-le via : https://developers.facebook.com/tools/explorer/
   - Sélectionnez votre app
   - Sélectionnez votre page dans "Page Access Token"
   - Copiez le token

2. **Page ID** : `205855939507920` (déjà connu)

3. **Post ID** (optionnel) : ID d'un post existant pour commenter

## 🚀 Méthode 1 : Via Graph API Explorer (Recommandé)

1. Allez sur : https://developers.facebook.com/tools/explorer/
2. Sélectionnez votre app
3. Sélectionnez votre page dans "Page Access Token"
4. Créez un commentaire sur un post existant :
   ```
   POST /{POST_ID}/comments
   message=Test commentaire pour webhook
   ```
5. Ou créez un nouveau post :
   ```
   POST /{PAGE_ID}/feed
   message=Test post pour webhook
   ```

## 🚀 Méthode 2 : Via Script Node.js

Utilisez le script `test-webhook-via-graph-api.js` :

```bash
# Définir les variables d'environnement
$env:FACEBOOK_PAGE_ACCESS_TOKEN="VOTRE_TOKEN"
$env:FACEBOOK_PAGE_ID="205855939507920"
$env:FACEBOOK_POST_ID="ID_D_UN_POST_EXISTANT"  # Optionnel

# Exécuter le script
node backend/test-webhook-via-graph-api.js
```

## 📊 Différence entre Test et Événement Réel

### Format de TEST (bouton "Test" Facebook) :
```json
{
  "sample": {
    "field": "feed"
  },
  "sub_field_options": null
}
```
- ✅ Vérifie que le webhook répond
- ❌ Ne contient pas de données réelles
- ❌ Ne déclenche pas d'analyse d'intention

### Format d'ÉVÉNEMENT RÉEL :
```json
{
  "object": "page",
  "entry": [{
    "id": "205855939507920",
    "time": 1737480000,
    "changes": [{
      "field": "feed",
      "value": {
        "from": {
          "id": "123456789",
          "name": "John Doe"
        },
        "message": "Ceci est un vrai commentaire",
        "post_id": "post_123",
        "comment_id": "comment_456",
        "verb": "add",
        "created_time": 1737480000
      }
    }]
  }]
}
```
- ✅ Contient des données réelles
- ✅ Déclenche l'analyse d'intention
- ✅ Envoie un email de notification

## 🔍 Vérification

Après avoir créé un événement réel, vérifiez dans la console GDRI :

```
🔔🔔🔔 ===== WEBHOOK POST RECU =====
📦 Body reçu: { "object": "page", "entry": [...] }
🧪 WEBHOOK DE TEST FACEBOOK DÉTECTÉ  ← Ne devrait PAS apparaître
📝 Traitement de X change(s)...      ← Devrait apparaître
✅ Message extrait du feed            ← Devrait apparaître
```
