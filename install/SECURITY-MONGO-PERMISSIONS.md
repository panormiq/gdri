# Sécurité MongoDB - Gestion des Permissions

## ⚠️ Problème de sécurité avec `readWriteAnyDatabase`

Donner `readWriteAnyDatabase` à `gdri_admin` n'est **PAS RECOMMANDÉ** pour la production car :
- L'utilisateur a accès à **toutes** les bases de données MongoDB
- Si le compte est compromis, toutes les données sont exposées
- Violation du principe de moindre privilège

## ✅ Solutions sécurisées

### Solution 1 : Deux utilisateurs MongoDB (RECOMMANDÉ pour production)

**Principe :** Séparer les rôles
- Un utilisateur **admin** pour créer/gérer les bases (utilisé uniquement par les scripts d'installation)
- Un utilisateur **application** avec permissions limitées pour l'exécution normale

#### Étape 1 : Créer un utilisateur admin séparé
```javascript
use admin
db.createUser({
  user: "gdri_admin_setup",
  pwd: "MotDePasseSecuriseChangeEnProd",
  roles: [
    { role: "readWriteAnyDatabase", db: "admin" },
    { role: "dbAdminAnyDatabase", db: "admin" }
  ]
})
```

#### Étape 2 : Créer les bases avec l'admin setup
```javascript
// Script à exécuter quand une nouvelle entité est créée
use admin
db.auth("gdri_admin_setup", "MotDePasseSecuriseChangeEnProd")

// Créer la base pour l'entreprise
const dbName = "GDR-ENTREPRISE-690881831bcb9fec6f03a242"
const entrepriseDb = db.getSiblingDB(dbName)

// Créer les collections initiales
entrepriseDb.createCollection("collections")
entrepriseDb.createCollection("templates")
entrepriseDb.createCollection("documents")

// Créer un utilisateur spécifique pour cette base
entrepriseDb.createUser({
  user: `gdri_app_${dbName.replace(/[^a-zA-Z0-9]/g, "_")}`,
  pwd: "MotDePasseGenereAleatoirement",
  roles: [
    { role: "readWrite", db: dbName }
  ]
})
```

#### Étape 3 : Modifier l'application pour utiliser l'utilisateur spécifique
Modifier `backend/config/database.js` pour utiliser l'utilisateur spécifique à chaque base.

**AVANTAGE :** Chaque base a son propre utilisateur, isolation complète.

---

### Solution 2 : Permissions granulaires par base (COMPROMIS)

Créer les bases manuellement, puis donner des permissions spécifiques à `gdri_admin` pour chaque base :

```javascript
use admin

// Pour chaque entreprise, créer la base puis donner les permissions
const dbName = "GDR-ENTREPRISE-690881831bcb9fec6f03a242"
const entrepriseDb = db.getSiblingDB(dbName)
entrepriseDb.createCollection("_init")

// Donner les permissions pour cette base spécifique
db.grantRolesToUser("gdri_admin", [
  { role: "readWrite", db: dbName },
  { role: "dbAdmin", db: dbName }
])
```

**AVANTAGE :** Pas de permissions globales, mais nécessite de créer les bases manuellement.

---

### Solution 3 : Toutes les données dans une seule base (ALTERNATIVE)

Au lieu de bases séparées, utiliser une seule base avec un champ `entrepriseId` dans chaque collection :

**AVANTAGE :** 
- Plus simple à gérer
- Permissions simples (un seul utilisateur pour une base)
- Isolation par requêtes (avec index approprié)

**INCONVÉNIENT :**
- Moins d'isolation physique entre entreprises
- Besoin de filtres dans toutes les requêtes

---

### Solution 4 : Utiliser MongoDB Atlas avec VPC Peering (Production Cloud)

Si vous utilisez MongoDB Atlas :
- Utiliser des clusters séparés par entreprise
- Utiliser VPC peering pour l'isolation réseau
- Utiliser des utilisateurs spécifiques par cluster

---

## 🔒 Recommandation pour GDRI

**Pour le développement :** 
- Solution 1 ou 2 (selon votre préférence)

**Pour la production :**
- **Solution 1** (deux utilisateurs) OU
- **Solution 3** (une seule base avec `entrepriseId`) si l'isolation n'est pas critique

## 📝 Script pour créer une base d'entreprise sécurisée

Voir `install/create-entreprise-database-secure.js`
