# 📡 Guide : Recevoir des Webhooks Facebook

Maintenant que vos pages sont connectées et que les webhooks sont configurés, voici comment vérifier que tout fonctionne et recevoir des événements.

## ⚠️ Quand recevez-vous vraiment les webhooks ?

| Situation | Recevez-vous des webhooks ? |
|-----------|-----------------------------|
| **App en mode Développement** | ❌ **Aucun événement réel** (commentaire, post, message réel sur la page). Facebook n’envoie que les **tests** depuis le tableau de bord (bouton « Tester »). |
| **App en mode Production (publiée)** | ✅ **Oui** : Facebook envoie les événements réels (feed, mentions, messages si abonné et permission accordée). |

**En résumé :** même si la config webhook est correcte (URL vérifiée, abonnements faits), vous ne recevrez des **vrais** webhooks (commentaire, post, message) que lorsque l’app est **passée en mode Production**. En mode Développement, seul le bouton « Tester » dans Facebook Developer envoie un POST vers votre URL.

**Pour recevoir un webhook pour un vrai commentaire** : passer l’app en **Production** (voir ci-dessous), puis poster un commentaire sur la page ; le webhook arrivera automatiquement si la page est abonnée au champ `feed`.

Voir `install/PUBLIER-APP-FACEBOOK.md` pour publier l’app et passer en Production.

### Étapes pour recevoir un vrai commentaire

1. **Passer l’app en Production**  
   Facebook Developer → votre app → **Paramètres** → **Informations de base** → bascule **« Mode développement »** → **« Mise en ligne »** (Production).  
   *Si la bascule est grisée*, il faut d’abord remplir les infos obligatoires (politique de confidentialité, conditions d’utilisation, etc.) et éventuellement faire une révision pour les permissions avancées.

2. **Vérifier l’abonnement feed**  
   Dans GDRI, pour la page concernée, les webhooks doivent inclure **feed** (déjà le cas si le test feed marche).

3. **Déclencher un vrai commentaire**  
   Sur la page Facebook, publiez un **post**, puis ajoutez un **commentaire** sous ce post (ou faites commenter par quelqu’un d’autre).  
   Votre serveur doit recevoir un POST sur `/api/facebook/webhook` et les logs doivent afficher `🔔 WEBHOOK POST RECU` puis `Webhook traité`.

## ✅ Vérifications préalables

### 1. Vérifier que le serveur Node.js est démarré

Le serveur doit être en cours d'exécution pour recevoir les webhooks :

```powershell
# Vérifier que le serveur écoute sur le port 3000
netstat -ano | findstr :3000
```

Si le serveur n'est pas démarré :
```powershell
cd C:\xampp\htdocs\gdri\backend
node server.js
```

### 2. Vérifier la configuration dans Facebook Developer

1. Allez sur [Facebook Developers](https://developers.facebook.com/)
2. Sélectionnez votre application
3. Allez dans **Webhooks** (menu de gauche)
4. Vérifiez que le webhook est configuré :
   - **URL du callback** : `https://www.gdr-innovation.fr/api/facebook/webhook`
   - **Verify Token** : `gdri_facebook_webhook_token_2024`
   - **Statut** : ✅ Vérifié

### 3. Vérifier les abonnements aux pages

Dans Facebook Developer → Webhooks → **Abonnements** :

1. Vérifiez que vos pages sont listées
2. Pour chaque page, vérifiez les **Champs d'abonnement** :
   - `feed` : pour les posts et commentaires
   - `mention` : pour les mentions
   - `messages` : pour les messages privés (si autorisé)

## 🔔 Comment les webhooks sont reçus

### Flux automatique

1. **Un événement se produit sur Facebook** (ex: nouveau commentaire sur votre page)
2. **Facebook envoie un POST** vers `https://www.gdr-innovation.fr/api/facebook/webhook`
3. **Le serveur Node.js reçoit le webhook** et répond immédiatement `200 OK` à Facebook
4. **Le webhook est traité en arrière-plan** par `WebhookService`
5. **Les données sont analysées** et sauvegardées dans MongoDB
6. **Des notifications email sont envoyées** si configurées

### Logs dans la console Node.js

Quand un webhook est reçu, vous verrez dans la console :

```
🔔🔔🔔 ===== WEBHOOK POST RECU =====
  ⏰ Timestamp: 2026-01-XX...
  📥 Method: POST
  📥 URL: /api/facebook/webhook
  📥 IP: ...
  📦 Body reçu: { ... }
  ✅ Réponse 200 envoyée à Facebook

📨 ===== WEBHOOK FACEBOOK RECU =====
  🔄 Traitement du webhook...
  ✅ Webhook traité: X entry(s), Y event(s)
```

## 🧪 Tester la réception des webhooks

### Méthode 1 : Utiliser le bouton "Tester" dans Facebook Developer

1. Allez dans **Facebook Developer → Webhooks**
2. Cliquez sur **Tester** à côté de votre webhook
3. Sélectionnez un événement (ex: `feed`)
4. Cliquez sur **Envoyer un test**
5. Vérifiez les logs du serveur Node.js

### Méthode 2 : Créer un événement réel

**Pour tester `feed` :**
1. Allez sur votre page Facebook
2. Créez un nouveau post ou commentaire
3. Vérifiez les logs du serveur Node.js

**Pour tester `mention` :**
1. Mentionnez votre page dans un post ou commentaire
2. Vérifiez les logs du serveur Node.js

**Pour tester `messages` :**
1. Envoyez un message privé à votre page
2. Vérifiez les logs du serveur Node.js

### Méthode 3 : Vérifier les logs Apache

Si vous voulez voir les requêtes HTTP brutes :

```powershell
# Voir les dernières requêtes webhook
Get-Content C:\xampp\apache\logs\access.log | Select-String "webhook" | Select-Object -Last 10
```

## 🔍 Vérifier que les webhooks sont bien reçus

### 1. Vérifier les logs Node.js

Les webhooks reçus apparaissent dans la console du serveur Node.js avec des emojis 🔔.

### 2. Vérifier dans MongoDB

Les webhooks sont sauvegardés dans la collection `facebook_webhooks` :

```javascript
// Dans MongoDB Compass ou via mongo shell
db.facebook_webhooks.find().sort({ received_at: -1 }).limit(10)
```

### 3. Vérifier les événements traités

Les événements extraits sont dans la collection `facebook_events` :

```javascript
db.facebook_events.find().sort({ created_at: -1 }).limit(10)
```

## ⚠️ Problèmes courants

### Le webhook n'est pas reçu (événements réels)

**À vérifier en premier :**
1. **L’app est-elle en mode Production ?** En mode Développement, Facebook n’envoie pas d’événements réels. Passez en Production dans Paramètres → Informations de base (après révision si besoin).
2. **URL accessible depuis Internet** : Facebook doit pouvoir faire un POST vers votre URL (ex. `https://www.gdr-innovation.fr/api/facebook/webhook`). Pas de localhost.

**Ensuite :**
3. ✅ Le serveur Node.js est démarré et reçoit bien les requêtes (Apache ou reverse proxy qui pointe vers le backend)
4. ✅ L’URL du webhook est correcte dans Facebook Developer et le statut est « Vérifié »
5. ✅ Le Verify Token correspond (`gdri_facebook_webhook_token_2024`)
6. ✅ Chaque page est **abonnée** aux champs voulus (feed, mention, messages) via l’interface GDRI ou l’API `subscribed_apps`

**Test de connectivité :**
```powershell
# Tester si l'URL est accessible
curl -X GET "https://www.gdr-innovation.fr/api/facebook/webhook?hub.mode=subscribe&hub.verify_token=gdri_facebook_webhook_token_2024&hub.challenge=test123"
```

### Le webhook est reçu mais pas traité

**Vérifications :**
1. ✅ Le body de la requête est bien parsé (vérifier les logs)
2. ✅ La structure des données correspond à ce que Facebook envoie
3. ✅ Le `WebhookService` est bien initialisé
4. ✅ MongoDB est connecté

### Les événements ne sont pas extraits

**Vérifications :**
1. ✅ Les champs d'abonnement sont corrects dans Facebook Developer
2. ✅ Le `pageId` dans le webhook correspond à une page connectée
3. ✅ Les permissions Facebook sont correctes

## 📊 Monitoring

### Surveiller les webhooks en temps réel

Regardez la console Node.js pour voir les webhooks arriver en temps réel.

### Statistiques

Vous pouvez créer une page de monitoring pour voir :
- Nombre de webhooks reçus aujourd'hui
- Derniers événements reçus
- Erreurs éventuelles

## 🎯 Prochaines étapes

Une fois que les webhooks sont reçus :

1. **Analyser les intentions** : Les messages sont analysés par IA (si configuré)
2. **Notifications email** : Des emails sont envoyés pour les événements importants
3. **Dashboard** : Créer un dashboard pour visualiser les événements

## 📝 Notes importantes

- **Réponse rapide** : Le serveur répond immédiatement `200 OK` à Facebook, puis traite l'événement en arrière-plan
- **Fiabilité** : Si le traitement échoue, l'événement est quand même sauvegardé pour retraitement
- **Rate limiting** : Facebook peut limiter le nombre de webhooks envoyés si le serveur ne répond pas assez vite
- **Mode développement** : En mode développement, Facebook peut ne pas envoyer tous les événements

## 🔗 Ressources

- [Documentation Facebook Webhooks](https://developers.facebook.com/docs/graph-api/webhooks)
- [Guide de débogage des webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started)
