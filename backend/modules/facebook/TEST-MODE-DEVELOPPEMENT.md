# Guide : Tester les Webhooks Facebook en Mode Développement

## ⚠️ Problème : Mode Test Facebook

Quand votre app Facebook est en **mode test** (non publiée), Facebook **ne envoie pas de webhooks réels** pour les événements de production.

### Pourquoi ?
- Facebook limite les webhooks en mode test pour des raisons de sécurité
- Les webhooks ne sont envoyés que pour les **testeurs** ajoutés à l'app
- Les événements réels peuvent ne pas déclencher de webhooks

## ✅ Solution : Tester Localement avec des Scripts

En attendant la publication de l'app, utilisez les **scripts de test locaux** pour simuler les webhooks Facebook.

## 🚀 Comment Tester

### Étape 1 : Démarrer le Serveur GDRI

```bash
cd backend
node server.js
```

Vous devriez voir :
```
✅ Serveur backend démarré sur http://0.0.0.0:3000
✅ Module Facebook prêt
```

### Étape 2 : Tester avec un Script Local

Dans un **nouveau terminal**, exécutez un des scripts de test :

#### Option A : Test avec un commentaire (feed)
```bash
node backend/test-webhook-business-management.js
```

#### Option B : Test avec une mention
```bash
node backend/test-webhook-mention.js
```

#### Option C : Test interactif
```bash
node backend/test-webhook-demo.js
```

### Étape 3 : Observer les Logs

Dans la console du serveur GDRI, vous devriez voir :
```
🌐🌐🌐 ===== REQUÊTE WEBHOOK DÉTECTÉE =====
🔔🔔🔔 ===== WEBHOOK POST RECU =====
📨 ===== WEBHOOK FACEBOOK RECU =====
✅ Webhook traité: 1 entry(s), 1 event(s)
```

## 📋 Scripts Disponibles

### 1. `test-webhook-business-management.js`
- Simule un commentaire sur un post
- Teste le champ "feed"
- Déclenche l'analyse d'intention

### 2. `test-webhook-mention.js`
- Simule une mention (@GDRInnovation)
- Teste les mentions dans les commentaires

### 3. `test-webhook-demo.js`
- Script interactif
- Permet de choisir le type de test

### 4. `test-webhook-commentaire.js`
- Simule un commentaire simple

## 🔍 Vérifications

### Vérifier que le webhook est bien reçu

1. **Dans la console du serveur**, vous devriez voir :
   ```
   🔔🔔🔔 ===== WEBHOOK POST RECU =====
   📦 Body reçu: {...}
   ```

2. **Vérifier dans MongoDB** :
   - Collection `facebook_webhooks` → devrait contenir l'événement
   - Collection `analyse_intention_results` → devrait contenir l'analyse

3. **Vérifier les emails** (si configuré) :
   - Un email devrait être envoyé avec les résultats de l'analyse

## 🎯 Tester le Champ "feed" Spécifiquement

Pour tester le champ "feed", utilisez `test-webhook-business-management.js` qui simule :
```json
{
  "object": "page",
  "entry": [{
    "id": "123456789",
    "changes": [{
      "field": "feed",
      "value": {
        "message": "Bonjour, je suis intéressé...",
        "from": { "name": "Marie Dubois" }
      }
    }]
  }]
}
```

## 📝 Notes Importantes

1. **Les scripts testent localement** → Pas besoin de Facebook en production
2. **Les données sont simulées** → Mais le traitement est identique
3. **Tous les logs sont affichés** → Vous pouvez voir exactement ce qui se passe
4. **L'analyse d'intention fonctionne** → Ollama est appelé normalement

## 🚀 Passer en Production

Quand vous serez prêt à publier l'app :

1. **Soumettez l'app pour révision** dans Facebook Developer
2. **Attendez l'approbation** de Facebook
3. **Une fois approuvée**, les webhooks réels fonctionneront automatiquement
4. **Les événements réels** déclencheront les webhooks

## 💡 Astuce

Pendant le développement, utilisez les scripts de test pour :
- ✅ Développer et déboguer
- ✅ Tester l'analyse d'intention
- ✅ Vérifier les emails
- ✅ Valider le flux complet

Quand l'app sera en production, tout fonctionnera automatiquement avec les vrais événements Facebook !
