# Configuration MongoDB - Super Admin

## ⚠️ IMPORTANT : Configuration initiale requise

Avant d'utiliser le système sécurisé, vous devez créer un utilisateur MongoDB avec les permissions globales pour créer les bases d'entreprises.

## Étape 1 : Créer l'utilisateur Super Admin

**Dans MongoDB Shell (mongosh) :**

```javascript
use admin

// Créer l'utilisateur super admin (à faire UNE SEULE FOIS)
db.createUser({
  user: "gdri_admin_setup",
  pwd: "CHANGER_EN_PRODUCTION_MOT_DE_PASSE_FORT",
  roles: [
    { role: "readWriteAnyDatabase", db: "admin" },
    { role: "dbAdminAnyDatabase", db: "admin" },
    { role: "userAdminAnyDatabase", db: "admin" }
  ]
})
```

## Étape 2 : Configurer les variables d'environnement

Créer ou modifier `.env` dans le dossier `backend/` :

```env
# Super Admin MongoDB (uniquement pour création d'entreprises)
MONGO_ADMIN_USER=gdri_admin_setup
MONGO_ADMIN_PASSWORD=CHANGER_EN_PRODUCTION_MOT_DE_PASSE_FORT

# Clé de chiffrement pour les credentials (32 caractères minimum)
CREDENTIALS_ENCRYPTION_KEY=CHANGER_EN_PRODUCTION_32_CHARS_MINIMUM
```

## Étape 3 : Vérifier la configuration

```javascript
use admin
db.getUser("gdri_admin_setup")
```

Vous devriez voir les rôles listés ci-dessus.

## 🔒 Sécurité

- Le super admin (`gdri_admin_setup`) est **UNIQUEMENT** utilisé pour créer les bases et utilisateurs
- Chaque entreprise a son propre utilisateur MongoDB (`entreprise_{entrepriseId}`)
- Les credentials sont chiffrés et stockés dans MongoDB
- L'application normale utilise les utilisateurs spécifiques, pas le super admin

## 📝 Notes

- En production, utilisez des mots de passe forts
- Ne jamais exposer les credentials dans le code source
- Utiliser un gestionnaire de secrets (Vault, AWS Secrets Manager, etc.) en production
