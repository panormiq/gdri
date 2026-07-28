# Environnement de développement GDRI (`test.gdri.fr`)

Objectif : **code isolé** + URL séparée + backend + Mongo dédiés.

| | Prod (`www.gdri.fr`) | Dev (`test.gdri.fr`) |
|---|---|---|
| Dossier | `C:\xampp\htdocs\gdri` | `C:\xampp\htdocs\gdri-dev` |
| Branche Git | `master` | `develop` |
| Backend Node | port **3000** | port **3001** |
| Mongo | `GDR-INNOVATION` | `GDR-INNOVATION-TEST` |
| API Apache | proxy → `:3000` | proxy → `:3001` |

## Workflow

1. **Coder** uniquement dans `C:\xampp\htdocs\gdri-dev` (ouvre ce dossier dans Cursor)
2. **Valider** sur `https://test.gdri.fr`
3. Quand OK : merge `develop` → `master` sur GitHub
4. **Déployer la prod** (manuel) :
   ```powershell
   cd C:\xampp\htdocs\gdri
   git pull origin master
   # puis redémarrer le backend prod (:3000)
   ```

Console web (rôle `DEV` ou `ADMIN_GDRI`) : mise à jour TEST + sync données — voir [LOCAL-VS-PROD.md](LOCAL-VS-PROD.md).

Ne pas éditer `htdocs\gdri` pour du développement quotidien.

## 1. DNS

```text
test.gdri.fr → IP de ton serveur
```

## 2. Apache

Le DocumentRoot de `test.gdri.fr` doit pointer vers `C:/xampp/htdocs/gdri-dev`  
(voir `install/apache-vhost-test.conf`). Redémarrer Apache après modification.

## 3. Cloner la base

```powershell
cd C:\xampp\htdocs\gdri-dev\backend
node scripts/clone-mongo-to-test.js
# pour écraser une base test déjà existante :
node scripts/clone-mongo-to-test.js --drop
```

Les bases `GDR-ENTREPRISE-*` ne sont **pas** clonées (partagées). Éviter les tests destructifs dessus.

## 4. Démarrer les backends

```powershell
# PROD — depuis le dossier prod
cd C:\xampp\htdocs\gdri\backend
.\Start-Backend.ps1

# DEV — depuis le dossier dev
cd C:\xampp\htdocs\gdri-dev\backend
.\Start-Backend.ps1 -Mode Test
.\Start-Backend.ps1 -Mode Test -Dev
```

Au premier lancement test, le script crée `.env.test` (gitignored) à partir de `.env.test.example` + secrets de `.env`.

## 5. Vérifier

1. Prod : `https://www.gdr-innovation.fr` → code `master` / API `:3000`
2. Dev : `https://test.gdri.fr/frontend/` → code `develop` / API `:3001`
3. Logs backend test : `MongoDB connecté ... (GDR-INNOVATION-TEST)`
