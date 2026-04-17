# Processus de Connexion Facebook - 3 Étapes

## ✅ Oui, c'est exactement ça !

Le processus de connexion à Facebook se fait en **3 étapes** :

## 📋 Étape 1 : OAuth (Connexion)

**Objectif** : L'utilisateur se connecte avec son compte Facebook et autorise l'application.

**Ce qui se passe** :
1. L'utilisateur clique sur "Se connecter avec Facebook"
2. Redirection vers Facebook pour se connecter
3. L'utilisateur autorise l'application GDRI
4. Facebook redirige vers GDRI avec un code
5. GDRI échange le code contre un **User Access Token**
6. GDRI récupère les pages de l'utilisateur
7. L'utilisateur sélectionne la page à connecter
8. GDRI récupère le **Page Access Token** automatiquement

**Résultat** : La page est connectée, le Page Access Token est sauvegardé.

**✅ Implémenté** : Oui, tout est fait automatiquement via OAuth.

---

## 📋 Étape 2 : Validation du Webhook

**Objectif** : Valider que notre serveur peut recevoir les webhooks de Facebook.

**Ce qui se passe** :
1. Dans Facebook Developer → Webhooks → Ajouter un webhook
2. URL : `https://www.gdr-innovation.fr/api/facebook/webhook`
3. Verify Token : `gdri_facebook_webhook_token_2024`
4. Facebook envoie une requête **GET** pour vérifier :
   ```
   GET /api/facebook/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=1234
   ```
5. Notre serveur vérifie le token et renvoie le challenge
6. Facebook valide que le webhook fonctionne

**Résultat** : Le webhook est validé et prêt à recevoir des événements.

**✅ Implémenté** : Oui, la route GET `/webhook` gère la validation.

**⚠️ Important** : Cette étape se fait **une seule fois** dans Facebook Developer (pas par utilisateur).

---

## 📋 Étape 3 : Souscription aux Événements

**Objectif** : S'abonner aux événements spécifiques (feed, mentions, etc.) pour recevoir les notifications.

**Événements disponibles** :
- **`feed`** : Posts, commentaires sur la page
- **`mentions`** : Mentions de la page dans des posts/commentaires
- **`messages`** : Messages directs (optionnel)

**Ce qui se passe** :

### Option A : Via Facebook Developer (Manuel - Actuel)

1. Dans Facebook Developer → Webhooks → Sélectionner le webhook
2. Cocher les événements souhaités :
   - ✅ `feed`
   - ✅ `mentions` (si disponible)
   - ✅ `messages` (optionnel)
3. Cliquer sur "Sauvegarder"

**⚠️ Limitation** : Cette configuration est **globale** pour toute l'application, pas par page.

### Option B : Via API Graph (Automatique - À implémenter)

1. Après la connexion OAuth (étape 1)
2. Utiliser le Page Access Token pour s'abonner automatiquement :
   ```javascript
   POST /{page_id}/subscribed_apps
   {
     "subscribed_fields": ["feed", "mentions"]
   }
   ```
3. L'abonnement est automatique pour chaque page connectée

**Résultat** : La page est abonnée aux événements, Facebook enverra des webhooks quand des événements se produisent.

**✅ Implémenté** : 
- Service créé : `WebhookSubscriptionService.js`
- À intégrer : Appeler automatiquement après la connexion OAuth

---

## 🎯 Processus Complet pour un Utilisateur

### Scénario : Un nouvel utilisateur veut connecter sa page Facebook

1. **OAuth** (Automatique) :
   - Clique "Se connecter avec Facebook"
   - Autorise l'application
   - Page connectée ✅

2. **Validation Webhook** (Déjà fait) :
   - L'admin GDRI a déjà configuré le webhook dans Facebook Developer
   - Pas besoin de refaire ✅

3. **Souscription** (À automatiser) :
   - Actuellement : Doit être fait manuellement dans Facebook Developer
   - Idéal : Automatique après la connexion OAuth
   - **À implémenter** : Appeler `WebhookSubscriptionService` après la connexion

---

## 🔄 Flux Complet

```
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 1 : OAuth                                             │
│ ─────────────────────────────────────────────────────────── │
│ Utilisateur → Clique "Se connecter"                        │
│ → Facebook (login + autorisation)                          │
│ → GDRI (récupère Page Access Token)                       │
│ → Page connectée ✅                                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 2 : Validation Webhook (Déjà fait par admin)         │
│ ─────────────────────────────────────────────────────────── │
│ Admin GDRI → Configure webhook dans Facebook Developer     │
│ → Facebook teste GET /webhook                              │
│ → Webhook validé ✅                                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 3 : Souscription aux Événements                       │
│ ─────────────────────────────────────────────────────────── │
│ Option A (Manuel) :                                         │
│ → Admin configure dans Facebook Developer                  │
│ → feed, mentions, messages cochés                          │
│                                                             │
│ Option B (Automatique - À implémenter) :                   │
│ → Après OAuth, appeler API Graph                            │
│ → POST /{page_id}/subscribed_apps                          │
│ → subscribed_fields: ["feed", "mentions"]                  │
│ → Abonnement automatique ✅                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ RÉSULTAT : La page reçoit les webhooks                     │
│ ─────────────────────────────────────────────────────────── │
│ → Nouveau post → Webhook POST /webhook                     │
│ → Nouveau commentaire → Webhook POST /webhook              │
│ → Mention → Webhook POST /webhook                          │
│ → GDRI traite et analyse automatiquement ✅                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Pour la Vidéo

### À montrer :

1. **Étape 1 - OAuth** (3-4 min) :
   - Cliquer "Se connecter avec Facebook"
   - Montrer la redirection vers Facebook
   - Montrer l'autorisation
   - Montrer le retour automatique
   - Montrer la page connectée

2. **Étape 2 - Validation Webhook** (1 min) :
   - Expliquer que c'est déjà configuré
   - Montrer rapidement dans Facebook Developer (optionnel)
   - Expliquer que c'est fait une seule fois par l'admin

3. **Étape 3 - Souscription** (1-2 min) :
   - Montrer dans Facebook Developer → Webhooks
   - Montrer les événements cochés (feed, mentions)
   - Expliquer que c'est global pour l'app
   - **OU** montrer l'automatisation si implémentée

4. **Test** (1-2 min) :
   - Créer un événement réel (post/commentaire)
   - Montrer le webhook qui arrive
   - Montrer le traitement automatique

---

## ✅ Résumé

- **Étape 1 (OAuth)** : ✅ Implémenté et automatique
- **Étape 2 (Validation)** : ✅ Implémenté, fait une fois par admin
- **Étape 3 (Souscription)** : ⚠️ Partiellement implémenté
  - Service créé : `WebhookSubscriptionService.js`
  - À intégrer : Appeler automatiquement après OAuth
