# Prod vs Dev (même PC)

| | Prod | Dev |
|---|---|---|
| Dossier | `C:\xampp\htdocs\gdri` | `C:\xampp\htdocs\gdri-dev` |
| Branche | `master` | `develop` |
| URL | `https://www.gdr-innovation.fr` | `https://test.gdri.fr` |
| Backend | `:3000` | `:3001` |
| Mongo | `GDR-INNOVATION` | `GDR-INNOVATION-TEST` |

## Règle d’or

- **Développer** dans `gdri-dev` uniquement (Cursor → ouvrir ce dossier).
- **Ne pas** modifier les fichiers de `gdri` pour du travail quotidien : c’est le live.
- **Déployer prod** = merge `develop` → `master`, puis `git pull` **manuel** dans `gdri` + restart backend `:3000`.

## Stagiaire / rôle DEV

| Environnement | Rôle | Accès |
|---|---|---|
| **Prod** (`www`) | `DEV` | Console **Déploiement** uniquement (update TEST + sync données) |
| **Test** (`test.gdri.fr`) | `ADMIN_GDRI` | Accès admin complet pour développer |

```powershell
# PROD — rôle DEV
cd C:\xampp\htdocs\gdri-dev\backend
node scripts\set-user-role.js stagiaire@email.com DEV

# TEST — rôle admin (base GDR-INNOVATION-TEST)
cd C:\xampp\htdocs\gdri-dev\backend
$env:GDRI_ENV_FILE = '.env.test'
node -r dotenv/config scripts\set-user-role.js stagiaire@email.com ADMIN_GDRI
# si dotenv/config lit .env par défaut, préférer :
#   node -e "require('dotenv').config({path:'.env.test'}); require('./scripts/set-user-role.js')"
# ou lancer set-user-role après avoir exporté les vars Mongo du .env.test
```

Console déploiement : page **Déploiement** sur www (après merge de ces changements sur `master`).

- **Mettre à jour TEST** → `git pull develop` dans `gdri-dev` + restart `:3001`
- **Synchroniser données** → clone `GDR-INNOVATION` → `GDR-INNOVATION-TEST`

Voir aussi : [ENV-TEST.md](ENV-TEST.md)
