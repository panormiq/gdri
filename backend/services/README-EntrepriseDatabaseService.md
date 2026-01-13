# Service de Gestion des Bases de Données d'Entreprises

## 🔒 Architecture Sécurisée

Ce service implémente une architecture sécurisée pour la gestion des bases de données MongoDB par entreprise.

### Principe

1. **Super Admin MongoDB** (`gdri_admin_setup`) :
   - Utilisé UNIQUEMENT pour créer les bases et utilisateurs
   - Encapsulé dans `backend/config/database-admin.js`
   - Credentials dans variables d'environnement

2. **Utilisateurs spécifiques par entreprise** :
   - Nom : `entreprise_{entrepriseId}`
   - Permissions : `readWrite` + `dbAdmin` uniquement sur leur base
   - Isolation complète entre entreprises

3. **Stockage sécurisé des credentials** :
   - Chiffrement AES-256-CBC
   - Stockage dans collection `entreprise_credentials`
   - Clé de chiffrement dans variable d'environnement

## 📁 Fichiers

- `backend/config/database-admin.js` : Super admin (encapsulé)
- `backend/services/EntrepriseDatabaseService.js` : Service de gestion
- `backend/config/database.js` : Utilise les utilisateurs spécifiques

## 🚀 Utilisation

### Créer une entreprise (automatique)

Quand une entreprise est créée via l'API `/api/entities`, le service :
1. Crée la base `GDR-ENTREPRISE-{entrepriseId}`
2. Crée les collections initiales
3. Crée l'utilisateur `entreprise_{entrepriseId}`
4. Stocke les credentials chiffrés

### Accès à une base d'entreprise

Le middleware `useCurrentEntrepriseDb` :
1. Récupère les credentials de l'entreprise
2. Se connecte avec l'utilisateur spécifique
3. Retourne la base de données

## ⚙️ Configuration

Voir `install/SETUP-MONGO-ADMIN.md` pour la configuration initiale.
