# Démarrage des services GDRI

Deux dossiers code :
- **Prod** : `C:\xampp\htdocs\gdri` (master, `:3000`)
- **Test** : `C:\xampp\htdocs\gdri-dev` (develop, `:3001`)

Scripts : `gdri-dev\demarrage\` (et copie après merge dans `gdri\demarrage\`).

## Scripts individuels

| Fichier | Service | Port |
|---|---|---|
| `01-backend-prod.bat` | Backend GDRI prod | 3000 |
| `02-backend-test.bat` | Backend GDRI **test** | 3001 |
| `02-backend-test-dev.bat` | Backend test + Dev/nodemon | 3001 |
| `03-backend-ia.bat` | BackendIA (Python) | 8000 |
| `04-security-monitor.bat` | Surveillance / alertes | — |
| `05-lostingame.bat` | Backend Lost in Game | 5001 |

## Mise à jour Git

| Fichier / UI | Action |
|---|---|
| Console → **Déploiement** | Pull **develop** dans `gdri-dev` + option sync Mongo — rôles `DEV` / `ADMIN_GDRI` |
| `10-update-test.bat` | Idem en local |
| `11-update-prod.bat` | Pull **master** dans `gdri` — **manuel uniquement** |

### Flux recommandé

1. Dev pousse sur `develop`
2. Console (ou stagiaire `DEV`) : **Mettre à jour TEST**
3. Vérifier `https://test.gdri.fr`
4. Merge `develop` → `master` sur GitHub
5. Sur le serveur : **`11-update-prod.bat`** ou `git pull` dans `htdocs\gdri` (pas depuis la console)

Voir `install\LOCAL-VS-PROD.md`.
