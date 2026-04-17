# Redémarrer le serveur Node.js

## ⚠️ Problème : Route 404

Si vous voyez une erreur `Cannot POST /api/facebook/oauth/save-pages`, c'est que le serveur Node.js n'a pas été redémarré après l'ajout de la nouvelle route.

## 🔄 Solution : Redémarrer le serveur

### Windows (XAMPP)

1. **Arrêter le serveur** :
   - Ouvrez le terminal où tourne le serveur Node.js
   - Appuyez sur `Ctrl + C` pour arrêter

2. **Redémarrer le serveur** :
   ```powershell
   cd C:\xampp\htdocs\gdri\backend
   node server.js
   ```

   Ou si vous utilisez un gestionnaire de processus :
   ```powershell
   # Avec PM2
   pm2 restart gdri-backend
   
   # Ou avec nodemon
   nodemon server.js
   ```

### Vérifier que le serveur est bien démarré

Vous devriez voir dans la console :
```
✅ Serveur backend démarré sur http://localhost:3000
📊 Environnement : development
🎯 Modules chargés : X
```

## ✅ Après redémarrage

La route `/api/facebook/oauth/save-pages` devrait maintenant être disponible.

Testez à nouveau la sauvegarde des webhooks.
