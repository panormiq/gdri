# Configuration MongoDB - Permissions pour les bases d'entités

## Problème
L'utilisateur `gdri_admin` a actuellement des permissions limitées à la base `GDR-INNOVATION` uniquement. Pour utiliser le système de bases séparées par entité, il faut étendre les permissions.

## Solution - 2 options

### Option 1 : Rôle global (Recommandé pour développement)
Donner un rôle `readWriteAnyDatabase` à l'utilisateur `gdri_admin`.

**Dans MongoDB Shell (mongosh) :**
```javascript
use admin
db.grantRolesToUser("gdri_admin", [ { role: "readWriteAnyDatabase", db: "admin" } ])
```

### Option 2 : Créer les bases manuellement
Si vous avez accès à MongoDB sans authentification ou avec un admin :

**Dans MongoDB Shell (mongosh) :**
```javascript
// Se connecter en tant qu'admin
use admin

// Pour chaque entité, créer la base et la collection
// Exemple pour l'entité GDRI :
use("GDR-ENTITY-690881831bcb9fec6f03a242")
db.createCollection("_init")
db.createCollection("mail_configs")
db.createCollection("emails")
```

## Script automatisé (à exécuter une seule fois)

Exécuter le script suivant dans MongoDB Shell :

```javascript
use admin

// Donner les permissions nécessaires à gdri_admin
db.grantRolesToUser("gdri_admin", [
    { role: "readWriteAnyDatabase", db: "admin" },
    { role: "dbAdminAnyDatabase", db: "admin" }
])

// Vérifier les permissions
db.getUser("gdri_admin")
```

## Alternative : Utiliser admin sans authentification (développement uniquement)

Pour le développement local, vous pouvez temporairement désactiver l'authentification MongoDB :

**Attention : Ne JAMAIS faire cela en production !**

1. Arrêter MongoDB
2. Modifier `C:\Program Files\MongoDB\Server\[version]\bin\mongod.cfg` :
   ```
   # Commenter la ligne security
   #security:
   #  authorization: enabled
   ```
3. Redémarrer MongoDB

Ensuite, les scripts PHP/Node.js pourront créer les bases sans problème.

