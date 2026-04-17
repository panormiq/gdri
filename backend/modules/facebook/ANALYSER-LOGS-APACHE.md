# Comment Analyser les Logs Apache pour les Webhooks

## 📍 Emplacement des Logs Apache dans XAMPP

Les logs Apache se trouvent généralement dans :
```
C:\xampp\apache\logs\
```

### Fichiers de logs importants :
- `access.log` - Toutes les requêtes HTTP reçues
- `error.log` - Les erreurs Apache
- `ssl_access.log` - Requêtes HTTPS (si configuré)
- `ssl_error.log` - Erreurs HTTPS (si configuré)

## 🔍 Comment Voir les Logs

### Option 1 : PowerShell (Recommandé)

Ouvrez PowerShell et exécutez :

```powershell
# Voir les 50 dernières lignes du log d'accès
Get-Content C:\xampp\apache\logs\access.log -Tail 50

# Voir les 50 dernières lignes du log d'erreur
Get-Content C:\xampp\apache\logs\error.log -Tail 50

# Suivre les logs en temps réel (comme tail -f)
Get-Content C:\xampp\apache\logs\access.log -Wait -Tail 20
```

### Option 2 : Notepad++ ou Éditeur de Texte

1. Ouvrez `C:\xampp\apache\logs\access.log`
2. Allez à la fin du fichier (Ctrl+End)
3. Regardez les dernières lignes

### Option 3 : Invite de Commande

```cmd
# Voir les 50 dernières lignes
powershell -Command "Get-Content C:\xampp\apache\logs\access.log -Tail 50"
```

## 🔎 Ce qu'il Faut Chercher

### Requêtes Webhook Facebook

Quand Facebook envoie un webhook, vous devriez voir dans `access.log` :

#### Pour GET (vérification) :
```
[IP] - - [DATE] "GET /api/facebook/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=... HTTP/1.1" 200 [TAILLE] "-" "facebookexternalhit/..."
```

#### Pour POST (événements) :
```
[IP] - - [DATE] "POST /api/facebook/webhook HTTP/1.1" 200 [TAILLE] "-" "facebookexternalhit/..."
```

### Indicateurs Importants

1. **User-Agent** : `facebookexternalhit` ou `facebookplatform`
2. **Méthode** : `POST` pour les événements, `GET` pour la vérification
3. **URL** : `/api/facebook/webhook`
4. **Code de statut** : `200` (succès) ou `403` (forbidden) ou `404` (not found)

## 📊 Exemple de Log

### Log d'Accès (access.log)
```
192.168.1.100 - - [25/Jan/2024:10:30:45 +0100] "GET /api/facebook/webhook?hub.mode=subscribe&hub.verify_token=gdri_facebook_webhook_token_2024&hub.challenge=123456 HTTP/1.1" 200 4 "-" "facebookexternalhit/1.1"
31.13.95.36 - - [25/Jan/2024:10:31:12 +0100] "POST /api/facebook/webhook HTTP/1.1" 200 13 "-" "facebookexternalhit/1.1"
```

### Log d'Erreur (error.log)
Si quelque chose ne va pas, vous verrez :
```
[Fri Jan 25 10:30:45.123456 2024] [proxy:error] [client 31.13.95.36] AH00898: Error reading from remote server returned by /api/facebook/webhook
```

## 🎯 Diagnostic

### Si vous voyez des requêtes dans access.log :

✅ **Les requêtes arrivent à Apache**
- Vérifiez si elles sont redirigées vers Node.js
- Vérifiez les logs du serveur GDRI

### Si vous NE voyez PAS de requêtes :

❌ **Les requêtes n'arrivent pas à Apache**
- Problème d'URL dans Facebook
- Problème de DNS
- Problème de firewall
- Problème de port (443 doit être ouvert)

## 🔧 Commandes Utiles

### Filtrer les Requêtes Webhook

```powershell
# Voir uniquement les requêtes webhook
Get-Content C:\xampp\apache\logs\access.log | Select-String "webhook"

# Voir les requêtes Facebook
Get-Content C:\xampp\apache\logs\access.log | Select-String "facebook"

# Voir les dernières 100 lignes avec webhook
Get-Content C:\xampp\apache\logs\access.log -Tail 100 | Select-String "webhook"
```

### Suivre les Logs en Temps Réel

```powershell
# Suivre access.log en temps réel
Get-Content C:\xampp\apache\logs\access.log -Wait -Tail 20

# Dans un autre terminal, cliquez sur "Test" dans Facebook
# Vous devriez voir la requête apparaître immédiatement
```

## 📝 Checklist de Diagnostic

1. [ ] Ouvrir `access.log` et aller à la fin
2. [ ] Cliquer sur "Test" dans Facebook Developer
3. [ ] Observer si une nouvelle ligne apparaît dans `access.log`
4. [ ] Vérifier l'IP source (devrait être une IP Facebook)
5. [ ] Vérifier le code de statut (200 = succès)
6. [ ] Vérifier `error.log` pour les erreurs

## 💡 Prochaines Étapes

1. **Ouvrez les logs Apache** avec PowerShell
2. **Cliquez sur "Test" dans Facebook Developer**
3. **Observez si une nouvelle ligne apparaît**
4. **Dites-moi ce que vous voyez** dans les logs

Si vous voyez la requête dans `access.log` mais pas dans les logs GDRI → Problème de reverse proxy
Si vous ne voyez rien dans `access.log` → Problème d'URL/firewall/DNS
