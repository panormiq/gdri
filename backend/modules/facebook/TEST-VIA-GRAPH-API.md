# Tester les Webhooks via l'API Graph Facebook

## 📋 Principe

L'API Graph Facebook ne peut pas **envoyer directement** des webhooks de test, mais on peut l'utiliser pour **créer un événement réel** (commentaire de test) qui déclenchera automatiquement un webhook.

## 🚀 Utilisation

### Étape 1 : Configuration

Créez un fichier `.env` dans le dossier `backend/` avec :

```env
FACEBOOK_APP_ID=votre_app_id
FACEBOOK_APP_SECRET=votre_app_secret
FACEBOOK_PAGE_ACCESS_TOKEN=votre_page_access_token
FACEBOOK_PAGE_ID=votre_page_id
FACEBOOK_POST_ID=id_du_post_existant  # Optionnel
```

### Étape 2 : Obtenir un Page Access Token

1. Allez dans [Facebook Developer Console](https://developers.facebook.com/)
2. Sélectionnez votre App
3. Allez dans **Outils** → **Graph API Explorer**
4. Sélectionnez votre **Page** dans le menu déroulant
5. Générez un token avec les permissions :
   - `pages_manage_posts` (pour créer des posts/commentaires)
   - `pages_read_engagement` (pour lire les interactions)

### Étape 3 : Exécuter le Script

```bash
node backend/test-webhook-via-graph-api.js
```

## 📊 Ce qui se passe

1. Le script crée un **commentaire de test** sur votre page Facebook
2. Facebook détecte l'événement
3. Facebook envoie un **webhook "feed"** vers votre serveur
4. Votre serveur GDRI reçoit et traite le webhook

## ⚠️ Limitations en Mode Test

En mode test (app non publiée) :
- Les webhooks peuvent ne pas être envoyés pour tous les événements
- Seuls les testeurs ajoutés à l'app peuvent déclencher des webhooks
- Les événements réels peuvent ne pas déclencher de webhooks

## ✅ Avantages

- Test avec de **vrais événements Facebook**
- Vérifie que le webhook fonctionne de bout en bout
- Permet de tester avec l'API Graph réelle

## 🔍 Vérification

Après avoir exécuté le script :

1. **Vérifiez la console du serveur GDRI** :
   ```
   🟢🟢🟢 ===== REQUÊTE WEBHOOK DÉTECTÉE =====
   🔔🔔🔔 ===== WEBHOOK POST RECU =====
   ```

2. **Vérifiez votre page Facebook** :
   - Un commentaire de test devrait apparaître

3. **Vérifiez MongoDB** :
   - Collection `facebook_webhooks` → devrait contenir l'événement
   - Collection `analyse_intention_results` → devrait contenir l'analyse

## 💡 Alternative : Script Local

Si l'API Graph ne fonctionne pas en mode test, utilisez le script local :

```bash
node backend/test-webhook-business-management.js
```

Ce script simule un webhook sans passer par Facebook.
