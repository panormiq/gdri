# Que faire après avoir enregistré les webhooks ?

## ✅ Ce qui est maintenant configuré

Vous avez enregistré les événements webhook suivants :
- **`feed`** : Posts et commentaires sur la page
- **`mention`** : Mentions de la page
- **`messages`** : Messages privés (si permission accordée)

## 🔄 Ce qui se passe automatiquement

### 1. Facebook envoie des webhooks

Dès qu'un événement se produit sur votre page Facebook :
- ✅ Un nouveau post est publié
- ✅ Un commentaire est ajouté
- ✅ La page est mentionnée
- ✅ Un message privé est reçu

Facebook envoie automatiquement un **POST** vers :
```
https://www.gdr-innovation.fr/api/facebook/webhook
```

### 2. Notre serveur reçoit et traite

Le serveur Node.js :
1. **Reçoit le webhook** (route `POST /api/facebook/webhook`)
2. **Répond immédiatement** à Facebook (200 OK) - **obligatoire**
3. **Traite l'événement en arrière-plan** via `WebhookService`
4. **Extrait les messages/commentaires**
5. **Analyse l'intention** via Ollama (si configuré)
6. **Envoie un email** de notification (si configuré)

## 🧪 Comment tester que ça fonctionne

### Méthode 1 : Tester avec Facebook Developer

1. Allez dans **Facebook Developer** → **Votre App** → **Webhooks**
2. Sélectionnez votre webhook
3. Cliquez sur **"Tester"** à côté de chaque événement :
   - **Test feed** : Simule un nouveau post
   - **Test mention** : Simule une mention
   - **Test messages** : Simule un message privé

4. **Vérifiez les logs Node.js** :
   ```bash
   # Dans le terminal où tourne le serveur Node.js
   # Vous devriez voir :
   🔔🔔🔔 ===== WEBHOOK POST RECU =====
   📦 Données complètes reçues: {...}
   📨 ===== WEBHOOK FACEBOOK RECU =====
   ✅ Webhook traité: X entry(s), Y event(s)
   ```

### Méthode 2 : Créer un événement réel

#### Tester "feed" :
1. Allez sur votre page Facebook
2. Publiez un nouveau post
3. Ou ajoutez un commentaire sur un post existant
4. Vérifiez les logs Node.js

#### Tester "mention" :
1. Depuis un autre compte Facebook
2. Mentionnez votre page dans un post ou commentaire : `@NomDeVotrePage`
3. Vérifiez les logs Node.js

#### Tester "messages" :
1. Envoyez un message privé à votre page Facebook
2. Vérifiez les logs Node.js

### Méthode 3 : Vérifier les logs Apache

```bash
# Vérifier les requêtes reçues
tail -f /chemin/vers/logs/apache/access.log | grep webhook

# Ou sur Windows avec XAMPP
# C:\xampp\apache\logs\access.log
```

## 📊 Où voir les résultats

### 1. Logs Node.js (Console)

Le serveur Node.js affiche des logs détaillés :

```
🔔🔔🔔 ===== WEBHOOK POST RECU =====
  ⏰ Timestamp: 2026-02-XX...
  📥 Method: POST
  📥 URL: /api/facebook/webhook
  📦 Body reçu: {...}
  ✅ Réponse 200 envoyée à Facebook

📨 ===== WEBHOOK FACEBOOK RECU =====
  📦 Données complètes reçues: {...}
  🔄 Traitement du webhook...
  ✅ Webhook traité: 1 entry(s), 1 event(s)
```

### 2. Base de données MongoDB

Les webhooks sont sauvegardés dans la collection `facebook_webhooks` :

```javascript
// Vérifier les webhooks reçus
db.facebook_webhooks.find().sort({ received_at: -1 }).limit(10)
```

### 3. Emails de notification

Si configuré, vous recevrez un email à chaque événement avec :
- Le contenu du message/commentaire
- L'analyse d'intention (si activée)
- Les détails de l'événement

## 🔍 Vérifier que tout fonctionne

### Étape 1 : Vérifier que le serveur écoute

```bash
# Vérifier que Node.js écoute sur le port 3000
netstat -ano | findstr :3000

# Ou vérifier l'endpoint health
curl http://localhost:3000/api/health
```

### Étape 2 : Tester la réception webhook

Utilisez le bouton **"Tester"** dans Facebook Developer pour chaque événement.

### Étape 3 : Vérifier les logs

Regardez la console Node.js pour voir les logs détaillés.

### Étape 4 : Vérifier la base de données

Connectez-vous à MongoDB et vérifiez la collection `facebook_webhooks`.

## ⚠️ Problèmes courants

### Les webhooks n'arrivent pas

1. **Vérifier que le webhook est validé** :
   - Facebook Developer → Webhooks → Votre webhook
   - Le statut doit être ✅ "Validé"

2. **Vérifier l'URL** :
   - Doit être accessible publiquement
   - Doit répondre en HTTPS (en production)
   - Doit être : `https://www.gdr-innovation.fr/api/facebook/webhook`

3. **Vérifier le serveur Node.js** :
   - Doit être démarré
   - Doit écouter sur le bon port
   - Apache doit rediriger vers Node.js

4. **Vérifier les logs Apache** :
   - Les requêtes POST doivent arriver
   - Vérifier qu'elles sont bien redirigées vers Node.js

### Les webhooks arrivent mais ne sont pas traités

1. **Vérifier les logs Node.js** :
   - Y a-t-il des erreurs ?
   - Le body est-il bien parsé ?

2. **Vérifier la base de données** :
   - MongoDB est-il connecté ?
   - Les collections existent-elles ?

3. **Vérifier WebhookService** :
   - Est-il bien initialisé ?
   - Y a-t-il des erreurs dans le traitement ?

## 📝 Prochaines étapes

### 1. Configurer l'analyse d'intention

Si vous voulez analyser automatiquement les messages :
- Allez sur `/pages/modules/analyse-intention-config.php`
- Configurez Ollama
- Activez l'analyse pour Facebook

### 2. Configurer les notifications email

Si vous voulez recevoir des emails :
- Configurez l'envoi d'emails dans le système
- Les notifications seront envoyées automatiquement

### 3. Surveiller les webhooks

- Surveillez les logs régulièrement
- Vérifiez la base de données
- Testez périodiquement avec Facebook Developer

## 🎯 Résumé

✅ **Vous avez fait** :
- Enregistré les webhooks (feed, mention, messages)

🔄 **Ce qui se passe maintenant** :
- Facebook envoie automatiquement les événements
- Le serveur les reçoit et les traite
- Les données sont sauvegardées dans MongoDB

🧪 **Pour tester** :
- Utilisez le bouton "Tester" dans Facebook Developer
- Ou créez des événements réels sur votre page
- Vérifiez les logs Node.js

📊 **Pour voir les résultats** :
- Logs Node.js (console)
- Base de données MongoDB
- Emails de notification (si configuré)

## 🔗 Documentation

- Guide test webhooks : `install/TEST-WEBHOOKS-AVEC-CURL.md`
- Guide diagnostic : `backend/modules/facebook/DIAGNOSTIC-WEBHOOK-TEST.md`
- Explication webhooks : `backend/modules/facebook/WEBHOOK-EXPLICATION.md`
