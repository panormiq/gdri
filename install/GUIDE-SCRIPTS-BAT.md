# 📋 Guide d'utilisation des scripts .bat

## 📁 Scripts disponibles

### Scripts individuels

1. **`start-gdri-backend.bat`**
   - Démarre le backend GDRI sur le port 3000
   - Chemin : `C:\xampp\htdocs\gdri\backend`
   - Commande : `node server.js`

2. **`start-doc-template-backend.bat`**
   - Démarre le backend doc_template sur le port 5005
   - Chemin : `C:\xampp\htdocs\continue\doc_template\back`
   - Commande : `npm run dev` (si package.json existe) ou `node server.js`

3. **`start-security-monitor.bat`**
   - Démarre le Security Monitor
   - Surveille les logs Apache et envoie des alertes par email
   - Commande : `node backend/security-monitor.js`

### Script global

4. **`start-all-backends.bat`**
   - Démarre tous les services en une fois
   - Ouvre une fenêtre séparée pour chaque service
   - Utile pour démarrer rapidement tous les backends

## 🚀 Utilisation

### Méthode 1 : Double-clic

Double-cliquez simplement sur le script .bat souhaité dans l'explorateur Windows.

### Méthode 2 : Ligne de commande

```cmd
cd C:\xampp\htdocs\gdri\install
start-gdri-backend.bat
```

### Méthode 3 : Démarrer tous les services

```cmd
cd C:\xampp\htdocs\gdri\install
start-all-backends.bat
```

## ⚙️ Configuration

### Pour doc_template

Si le chemin de doc_template est différent, modifiez la variable dans `start-doc-template-backend.bat` :

```bat
set "BACKEND_PATH=C:\xampp\htdocs\continue\doc_template\back"
```

### Pour le Security Monitor

Assurez-vous que le fichier `.env` est configuré à la racine du projet avec :
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SECURITY_ALERT_EMAIL`

## 🛑 Arrêter les services

Pour arrêter un service :
- Fermez la fenêtre de commande correspondante
- Ou appuyez sur `Ctrl+C` dans la fenêtre

## 📝 Notes

- Les scripts vérifient que les fichiers nécessaires existent avant de démarrer
- Chaque service s'ouvre dans sa propre fenêtre pour faciliter le monitoring
- Les erreurs sont affichées dans la fenêtre de commande

## 🔧 Dépannage

### Le service ne démarre pas

1. Vérifiez que Node.js est installé et dans le PATH
2. Vérifiez que les chemins dans les scripts sont corrects
3. Vérifiez que les fichiers nécessaires existent (server.js, package.json, etc.)

### Le port est déjà utilisé

Si vous voyez une erreur "port already in use" :
1. Fermez les autres instances du service
2. Ou modifiez le port dans la configuration du service

### doc_template ne démarre pas

1. Vérifiez que le chemin dans `start-doc-template-backend.bat` est correct
2. Vérifiez que le dossier `back` existe et contient `package.json` ou `server.js`
