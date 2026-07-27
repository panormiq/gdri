# Environnement de test GDRI (`test.gdri.fr`)

Objectif : même code / même XAMPP, URL séparée, backend + Mongo dédiés.

| | Prod (`www.gdri.fr`) | Test (`test.gdri.fr`) |
|---|---|---|
| Frontend | même dossier `htdocs/gdri` | idem |
| Backend Node | port **3000** | port **3001** |
| Mongo | `GDR-INNOVATION` | `GDR-INNOVATION-TEST` |
| API Apache | proxy → `:3000` | proxy → `:3001` |

## 1. DNS

Créer un enregistrement A (ou CNAME) :

```text
test.gdri.fr → IP de ton serveur
```

## 2. Apache

Ajouter le contenu de `install/apache-vhost-test.conf` dans  
`C:\xampp\apache\conf\extra\httpd-vhosts.conf`, puis redémarrer Apache.

SSL : idéalement un certificat wildcard `*.gdri.fr`, sinon un certificat pour `test.gdri.fr`.

## 3. Cloner la base

```powershell
cd C:\xampp\htdocs\gdri\backend
node scripts/clone-mongo-to-test.js
# pour écraser une base test déjà existante :
node scripts/clone-mongo-to-test.js --drop
```

Les bases `GDR-ENTREPRISE-*` ne sont **pas** clonées (partagées). Éviter les tests destructifs dessus.

## 4. Démarrer les backends

Raccourcis double-clic : dossier **`gdri/demarrage/`**

```text
00-tout.bat                 → prod + IA + monitor + lostingame (PAS le test)
01-backend-prod.bat         → :3000
02-backend-test.bat         → :3001 (manuel)
02-backend-test-dev.bat     → :3001 + Dev (manuel)
03-backend-ia.bat
04-security-monitor.bat
05-lostingame.bat
```

Ou en PowerShell :

```powershell
cd C:\xampp\htdocs\gdri\backend
.\Start-Backend.ps1              # prod
.\Start-Backend.ps1 -Mode Test   # test
.\Start-Backend.ps1 -Mode Test -Dev
```

Au premier lancement test, le script crée `.env.test` (gitignored) à partir de `.env.test.example` + secrets de `.env`.

## 5. Vérifier

1. Ouvrir `https://test.gdri.fr/frontend/` (ou http selon SSL)
2. Les appels API doivent aller vers `test.gdri.fr/api/...` → Node `:3001`
3. Logs backend test : `MongoDB connecté ... (GDR-INNOVATION-TEST)`

## Notes équipe

- Le code se met à jour via `git pull` sur le serveur (même dossier).
- `test.gdri.fr` voit toujours le code actuellement déployé dans `htdocs/gdri` (pas une 2e copie).
- Pour isoler aussi le code plus tard : 2e checkout + DocumentRoot dédié (optionnel).
