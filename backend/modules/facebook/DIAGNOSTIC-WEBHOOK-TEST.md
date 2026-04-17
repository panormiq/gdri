# Diagnostic : Test Webhook Facebook "feed"

## 🔍 Vérifications à Faire

### 1. Vérifier que le Serveur est Démarré

Dans la console, vous devriez voir :
```
✅ Serveur backend démarré sur http://0.0.0.0:3000
✅ Module Facebook prêt
```

### 2. Vérifier l'URL dans Facebook Developer

L'URL doit être exactement :
```
https://www.gdr-innovation.fr/api/facebook/webhook
```

**SANS** le port `:3443` (utilisez le port HTTPS standard 443)

### 3. Tester le Webhook depuis Facebook

1. Allez dans Facebook Developer Console
2. Sélectionnez votre App
3. Allez dans "Webhooks"
4. Trouvez le champ "feed"
5. Cliquez sur "Tester" (ou "Send Test")

### 4. Observer les Logs dans la Console GDRI

Quand vous cliquez sur "Tester", vous devriez voir **IMMÉDIATEMENT** :

#### Si le POST arrive :
```
🔴🔴🔴 ===== REQUÊTE WEBHOOK AVANT PARSING =====
  📥 POST /api/facebook/webhook
  📥 IP: [IP de Facebook]
  📥 Content-Type: application/json
  📥 X-Hub-Signature: sha256=...
```

Puis :
```
🌐🌐🌐 ===== REQUÊTE WEBHOOK DÉTECTÉE (MIDDLEWARE GLOBAL) =====
🔔🔔🔔 ===== WEBHOOK POST RECU =====
```

#### Si le POST n'arrive PAS :
- **Aucun log** n'apparaît
- Cela signifie que la requête n'atteint pas le serveur

## ❌ Si Aucun Log n'Apparaît

### Problème 1 : URL Incorrecte
- Vérifiez que l'URL dans Facebook est : `https://www.gdr-innovation.fr/api/facebook/webhook`
- **SANS** `:3443`
- **AVEC** `https://` (pas `http://`)

### Problème 2 : Serveur Non Accessible
- Vérifiez que le serveur est accessible depuis Internet
- Testez l'URL dans votre navigateur : `https://www.gdr-innovation.fr/api/facebook/webhook?hub.mode=subscribe&hub.verify_token=gdri_facebook_webhook_token_2024&hub.challenge=test`
- Vous devriez voir `test` dans la réponse

### Problème 3 : Firewall/Pare-feu
- Vérifiez que le port 443 (HTTPS) est ouvert
- Vérifiez que Apache redirige bien vers le port 3000

### Problème 4 : Reverse Proxy Apache
- Vérifiez la configuration Apache dans `httpd-vhosts.conf`
- Doit contenir : `ProxyPass /api/ http://127.0.0.1:3000/api/`

## ✅ Si les Logs Apparaissent mais le Body est Vide

### Problème : Body Non Parsé
- Vérifiez que `express.json()` est bien configuré (déjà fait)
- Vérifiez les logs pour voir si le Content-Type est correct

## 🎯 Test Manuel pour Vérifier

### Test 1 : Vérifier la Route GET (Vérification)
```
https://www.gdr-innovation.fr/api/facebook/webhook?hub.mode=subscribe&hub.verify_token=gdri_facebook_webhook_token_2024&hub.challenge=test123
```

**Résultat attendu** : Vous devriez voir `test123` dans la réponse

### Test 2 : Simuler un POST avec curl
```bash
curl -X POST https://www.gdr-innovation.fr/api/facebook/webhook \
  -H "Content-Type: application/json" \
  -d '{"object":"page","entry":[{"id":"123","time":1234567890,"changes":[{"field":"feed","value":{"message":"Test"}}]}]}'
```

**Résultat attendu** : Vous devriez voir les logs dans la console

## 📊 Checklist de Diagnostic

- [ ] Serveur GDRI démarré et accessible
- [ ] URL correcte dans Facebook Developer (sans `:3443`)
- [ ] Test GET fonctionne (vérification)
- [ ] Logs apparaissent quand vous cliquez sur "Tester"
- [ ] Body est parsé correctement
- [ ] Reverse proxy Apache configuré correctement

## 💡 Prochaines Étapes

1. **Redémarrer le serveur GDRI** (pour activer les nouveaux logs)
2. **Cliquer sur "Tester" dans Facebook Developer**
3. **Observer la console** - vous devriez voir les logs
4. **Me dire ce que vous voyez** (ou ne voyez pas) dans les logs
