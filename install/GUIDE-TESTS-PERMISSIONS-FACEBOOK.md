# Guide des Tests pour les Permissions Facebook

Ce guide explique comment utiliser les scripts de test pour démontrer l'utilisation des permissions Facebook dans notre application.

## Permissions testées

1. **`business_management`** - Gestion de la Page et réception des webhooks
2. **`read_insights`** - Lecture des statistiques et insights de la Page

---

## Test 1 : business_management

### Script
`backend/test-webhook-business-management.js`

### Ce que ce test démontre

- ✅ Réception de webhooks en temps réel depuis Facebook
- ✅ Analyse automatique des intentions via l'IA
- ✅ Routing intelligent vers les services appropriés
- ✅ Amélioration de la réactivité client

### Utilisation

```bash
node backend/test-webhook-business-management.js
```

### Ce qui se passe

1. Le script simule un webhook Facebook avec un commentaire
2. Le webhook est envoyé au backend Node.js
3. Le backend traite le webhook et déclenche l'analyse d'intention
4. Les résultats sont affichés dans la console

### Points clés pour la vidéo

- Montrer la réception du webhook en temps réel
- Afficher l'analyse automatique des intentions
- Expliquer comment cela améliore le service client
- Mentionner que sans `business_management`, les webhooks ne peuvent pas être reçus automatiquement

### Script vidéo
Voir `install/SCRIPT-VIDEO-BUSINESS-MANAGEMENT.txt`

---

## Test 2 : read_insights

### Script
`backend/test-read-insights.js`

### Ce que ce test démontre

- ✅ Accès aux statistiques de la Page Facebook
- ✅ Analyse des tendances de communication
- ✅ Optimisation de la stratégie client avec des données agrégées
- ✅ Respect de la confidentialité (données anonymisées uniquement)

### Utilisation

```bash
node backend/test-read-insights.js
```

### Ce qui se passe

1. Le script simule un appel à l'API Graph Facebook
2. Les insights sont récupérés (fans, engagement, messages, etc.)
3. Une analyse automatique des tendances est effectuée
4. Des recommandations sont générées

### Points clés pour la vidéo

- Montrer l'accès aux insights via l'API Graph
- Afficher les métriques récupérées
- Expliquer l'analyse automatique des tendances
- Insister sur l'utilisation de données agrégées uniquement
- Mentionner le respect de la confidentialité

### Script vidéo
Voir `install/SCRIPT-VIDEO-READ-INSIGHTS.txt`

---

## Prérequis

### Backend Node.js
Le backend doit être démarré :

```bash
cd backend
node server.js
```

### MongoDB
MongoDB doit être démarré et accessible.

### Configuration
- Le backend doit être accessible sur `http://localhost:3000`
- Les modules Facebook et analyse-intention doivent être chargés

---

## Structure des fichiers

```
backend/
├── test-webhook-business-management.js  # Test business_management
└── test-read-insights.js                 # Test read_insights

install/
├── SCRIPT-VIDEO-BUSINESS-MANAGEMENT.txt  # Script vidéo business_management
├── SCRIPT-VIDEO-READ-INSIGHTS.txt        # Script vidéo read_insights
└── GUIDE-TESTS-PERMISSIONS-FACEBOOK.md   # Ce guide
```

---

## Conseils pour la vidéo

### business_management

1. **Démarrer le backend** et montrer qu'il écoute
2. **Exécuter le script** et montrer la réception du webhook
3. **Afficher les logs** du backend montrant le traitement
4. **Expliquer** comment cela améliore la réactivité client

### read_insights

1. **Exécuter le script** et montrer les insights récupérés
2. **Expliquer** chaque métrique affichée
3. **Montrer l'analyse** automatique des tendances
4. **Insister** sur l'utilisation de données agrégées uniquement

---

## Justifications pour Facebook

### business_management

> Notre application utilise business_management pour recevoir les webhooks en temps réel, analyser automatiquement les intentions des messages, et router intelligemment vers les services appropriés. Cela améliore notre réactivité client (réponse en quelques minutes au lieu de plusieurs heures).

### read_insights

> Notre application utilise read_insights pour analyser les tendances de communication de notre Page Facebook. Nous utilisons uniquement des données agrégées et anonymisées pour optimiser notre stratégie client, sans accéder à des données personnelles identifiantes.

---

## Support

Pour toute question ou problème avec ces tests, consultez :
- `install/JUSTIFICATION-BUSINESS-MANAGEMENT.md`
- `install/JUSTIFICATION-BUSINESS-MANAGEMENT-COURT.txt`
- Les logs du backend Node.js

