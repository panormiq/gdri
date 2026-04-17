# Webhooks Facebook en Mode Test

## 📋 Règles Facebook pour les Webhooks en Mode Test

D'après la documentation Facebook :

> **Les applications pourront seulement recevoir des webhooks test envoyés depuis le tableau de bord tant que l'application n'est pas publiée. Aucune donnée de production, y compris des admins, développeur(se)s ou testeur(se)s de l'application, ne sera diffusée sauf si l'application a été publiée.**

### Ce qui fonctionne en mode test :
- ✅ **Webhooks de test** depuis le tableau de bord Facebook Developer
- ✅ Le bouton "Test" dans l'interface Facebook Developer

### Ce qui NE fonctionne PAS en mode test :
- ❌ Webhooks pour les événements réels (posts, commentaires)
- ❌ Webhooks pour les admins/développeurs/testeurs
- ❌ Données de production

## 🔍 Problème Actuel

Le bouton "Test" dans Facebook Developer **devrait** envoyer un webhook de test, mais :
- ❌ Aucun log n'apparaît dans la console
- ❌ Le POST n'arrive pas au serveur

## ✅ Solutions

### Solution 1 : Vérifier l'URL du Webhook

L'URL dans Facebook Developer doit être exactement :
```
https://www.gdr-innovation.fr/api/facebook/webhook
```

**Vérifications** :
- ✅ **SANS** `:3443` (utilisez le port HTTPS standard 443)
- ✅ **AVEC** `https://` (pas `http://`)
- ✅ Accessible depuis Internet (pas localhost)

### Solution 2 : Vérifier les Logs

Quand vous cliquez sur "Test" dans Facebook, vous devriez voir dans la console :

```
🟢🟢🟢 ===== REQUÊTE WEBHOOK DÉTECTÉE (TRÈS TÔT) =====
  📥 POST /api/facebook/webhook
  📥 X-Hub-Signature: sha256=...
```

**Si vous ne voyez AUCUN log** :
- Le POST n'arrive pas au serveur
- Problème d'URL, de reverse proxy, ou de firewall

### Solution 3 : Tester avec un Script Local

Pour vérifier que le code fonctionne, utilisez un script de test local :

```bash
node backend/test-webhook-business-management.js
```

Si ça fonctionne → Le code est bon, le problème vient de l'URL/configuration Facebook.

### Solution 4 : Vérifier la Configuration Apache

Vérifiez que le reverse proxy Apache redirige bien les requêtes :

Dans `httpd-vhosts.conf`, vous devriez avoir :
```apache
<VirtualHost *:443>
    ServerName www.gdr-innovation.fr
    ...
    ProxyPass /api/ http://127.0.0.1:3000/api/
    ProxyPassReverse /api/ http://127.0.0.1:3000/api/
    ...
</VirtualHost>
```

## 🎯 Diagnostic

### Checklist

- [ ] Serveur GDRI démarré et accessible
- [ ] URL correcte dans Facebook Developer (sans `:3443`)
- [ ] Test GET fonctionne (vérification)
- [ ] Logs apparaissent quand vous cliquez sur "Test"
- [ ] Reverse proxy Apache configuré correctement
- [ ] Port 443 (HTTPS) accessible depuis Internet

### Si le POST n'arrive pas

1. **Vérifier l'URL** : Testez dans le navigateur avec les paramètres GET
2. **Vérifier Apache** : Les logs Apache devraient montrer la requête
3. **Vérifier le firewall** : Le port 443 doit être ouvert
4. **Vérifier les logs** : Regardez les logs Apache pour voir si la requête arrive

## 💡 Conclusion

En mode test, Facebook **devrait** envoyer des webhooks de test depuis le tableau de bord. Si le bouton "Test" ne fonctionne pas :

1. Vérifiez l'URL (sans `:3443`, avec `https://`)
2. Vérifiez les logs du serveur (vous devriez voir les requêtes)
3. Vérifiez la configuration Apache (reverse proxy)
4. Utilisez les scripts de test locaux pour vérifier que le code fonctionne

Une fois l'app publiée, les webhooks fonctionneront automatiquement pour tous les événements réels.
