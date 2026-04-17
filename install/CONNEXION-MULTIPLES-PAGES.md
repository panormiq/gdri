# Connexion à plusieurs pages Facebook

## ✅ Oui, vous pouvez connecter plusieurs pages !

Le système supporte la connexion à **plusieurs pages Facebook** pour une même entreprise.

## 🔄 Comment ça fonctionne

### Structure de la base de données

Chaque page est stockée séparément avec :
- `entrepriseId` : L'entreprise
- `pageId` : L'ID unique de la page Facebook
- Clé unique : `{ entrepriseId, pageId }`

Cela permet d'avoir **plusieurs pages par entreprise**.

### Flux de connexion

#### Première connexion

1. Cliquez sur **"Se connecter avec mon compte Facebook"**
2. Facebook vous demande d'autoriser l'application
3. Facebook retourne **toutes vos pages** :
   - Si **1 seule page** : connexion automatique ✅
   - Si **plusieurs pages** : vous devez en sélectionner **une** ✅

#### Connexion d'une deuxième page (ou plus)

1. Cliquez à nouveau sur **"Se connecter avec mon compte Facebook"**
2. Facebook vous demande d'autoriser l'application (si nécessaire)
3. Facebook retourne **toutes vos pages** (y compris celles déjà connectées)
4. Sélectionnez une **nouvelle page** (pas encore connectée)
5. La nouvelle page est ajoutée à votre liste ✅

## 📋 Interface avec onglets

Une fois plusieurs pages connectées :

- **Onglets par page** : Chaque page a son propre onglet
- **Configuration par page** : Vous pouvez configurer les webhooks séparément pour chaque page
- **Gestion indépendante** : Chaque page est gérée indépendamment

## 🎯 Exemple concret

### Scénario : Vous avez 3 pages Facebook

1. **Première connexion** :
   - Vous connectez "Page A"
   - Elle apparaît dans l'interface

2. **Deuxième connexion** :
   - Vous cliquez à nouveau sur "Se connecter"
   - Vous sélectionnez "Page B"
   - Maintenant vous avez 2 pages connectées

3. **Troisième connexion** :
   - Vous cliquez à nouveau sur "Se connecter"
   - Vous sélectionnez "Page C"
   - Maintenant vous avez 3 pages connectées

4. **Interface** :
   - 3 onglets apparaissent (un par page)
   - Vous pouvez configurer les webhooks pour chaque page séparément

## ⚠️ Points importants

### 1. Sélection d'une page à la fois

Lors de chaque connexion OAuth, vous devez sélectionner **une seule page**. Pour connecter plusieurs pages, vous devez vous reconnecter plusieurs fois.

### 2. Pages déjà connectées

Si vous essayez de reconnecter une page déjà connectée :
- Elle sera **mise à jour** (nouveau token, etc.)
- Elle ne sera **pas dupliquée**

### 3. Déconnexion

Vous pouvez déconnecter une page spécifique :
- Cliquez sur **"Déconnecter"** pour la page concernée
- Seule cette page sera déconnectée
- Les autres pages restent connectées

## 🔍 Vérifier les pages connectées

### Via l'interface

1. Allez sur `/pages/modules/facebook-config.php`
2. Les pages connectées apparaissent :
   - Si **1 page** : pas d'onglets, configuration directe
   - Si **plusieurs pages** : onglets avec le nom de chaque page

### Via l'API

```javascript
GET /api/facebook/config
```

Réponse :
```json
{
  "success": true,
  "data": { "pageId": "...", "pageName": "..." },
  "pages": [
    { "pageId": "...", "pageName": "Page A", "webhooks_subscribed": [...] },
    { "pageId": "...", "pageName": "Page B", "webhooks_subscribed": [...] },
    { "pageId": "...", "pageName": "Page C", "webhooks_subscribed": [...] }
  ]
}
```

### Via la base de données

```javascript
// MongoDB
db.facebook_configs.find({ entrepriseId: "VOTRE_ENTREPRISE_ID" })
```

## 💡 Astuce

### Connecter toutes vos pages rapidement

1. Connectez-vous une première fois → Sélectionnez la page 1
2. Reconnectez-vous → Sélectionnez la page 2
3. Reconnectez-vous → Sélectionnez la page 3
4. Etc.

Chaque connexion ajoute une nouvelle page à votre liste.

## 🎯 Résumé

✅ **Vous pouvez connecter** : Plusieurs pages Facebook

🔄 **Comment faire** :
- Cliquez plusieurs fois sur "Se connecter avec Facebook"
- À chaque fois, sélectionnez une page différente
- Chaque page est ajoutée à votre liste

📊 **Interface** :
- Une seule page : pas d'onglets
- Plusieurs pages : onglets avec le nom de chaque page

⚙️ **Configuration** :
- Webhooks configurés séparément pour chaque page
- Gestion indépendante de chaque page
