# Démarrage des services GDRI

Dossier à double-cliquer : `gdri/demarrage/`

## Scripts individuels

| Fichier | Service | Port |
|---|---|---|
| `01-backend-prod.bat` | Backend GDRI prod | 3000 |
| `02-backend-test.bat` | Backend GDRI **test** (manuel) | 3001 |
| `02-backend-test-dev.bat` | Backend test + Dev/nodemon (manuel) | 3001 |
| `03-backend-ia.bat` | BackendIA (Python) | 8000 |
| `04-security-monitor.bat` | Surveillance / alertes | — |
| `05-lostingame.bat` | Backend Lost in Game | 5001 |

## Mise à jour Git

| Fichier | Action |
|---|---|
| **Console GDRI** → Déploiement | Pull **develop** (TEST) — ADMIN_GDRI |
| `10-update-test.bat` | Idem en local |
| `11-update-prod.bat` | Pull **master** (PROD) — **local uniquement** |
| `11-update-prod-restart.bat` | Idem + restart `:3000` |

### Flux recommandé

1. Collab pousse sur `develop`
2. Admin GDRI : console plateforme → **Déploiement** → « Mettre à jour TEST »
3. Vérifier `https://test.gdri.fr`
4. Merge `develop` → `master` sur GitHub
5. Sur le serveur : **`11-update-prod.bat`** (pas depuis la console)

### Important (code partagé)

`test.gdri.fr` et `www` utilisent le **même dossier** `htdocs/gdri`.  
Un pull change donc le code des **deux** URLs.  
Seules les **bases Mongo** restent séparées (`GDR-INNOVATION` / `GDR-INNOVATION-TEST`).

Pour isoler aussi le code plus tard : 2e checkout (`gdri-test`) + DocumentRoot dédié.

Options PowerShell :

```powershell
cd C:\xampp\htdocs\gdri\demarrage
.\Update-From-Git.ps1 -Target Test
.\Update-From-Git.ps1 -Target Prod -RestartBackend
.\Update-From-Git.ps1 -Target Test -Force   # stash auto si fichiers locaux modifies
.\Update-From-Git.ps1 -Target Test -Branch ma-branche
```

## Tout lancer (sans le test)

Double-clic sur **`00-tout.bat`** :

- Backend prod
- BackendIA
- Security Monitor
- lostingame

Le backend **test** (`test.gdri.fr`) reste **manuel**.

## Accès distant

**Préféré :** console GDRI → **Déploiement** (ADMIN_GDRI) pour le TEST.  
PROD : scripts locaux `11-update-prod.bat` uniquement.

Le VPN SoftEther reste optionnel (accès réseau) — voir `REMOTE-ACCESS.md` si besoin.  
Pas nécessaire pour lancer les mises à jour TEST.
