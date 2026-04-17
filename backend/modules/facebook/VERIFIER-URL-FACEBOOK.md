# Vérification : URL du Webhook dans Facebook Developer

## ⚠️ PROBLÈME CRITIQUE

Les logs Apache montrent :
- ✅ GET de vérification arrive (IP Facebook 173.252.127.23)
- ❌ AUCUN POST de test n'arrive

## 🔍 Vérifications à Faire MAINTENANT

### 1. URL dans Facebook Developer

L'URL doit être EXACTEMENT :
```
https://www.gdr-innovation.fr/api/facebook/webhook
```

**CRITIQUE** :
- ❌ PAS `https://www.gdr-innovation.fr:3443/api/facebook/webhook`
- ✅ `https://www.gdr-innovation.fr/api/facebook/webhook` (SANS port)

### 2. Statut du Webhook

Dans Facebook Developer → Webhooks → "feed" :
- Doit être "Abonné" (vert) ✅
- PAS "Non abonné" (gris) ❌

### 3. Permissions

Dans Facebook Developer → Permissions :
- `pages_read_engagement` ✅
- `pages_manage_posts` ✅

## 🎯 Action Immédiate

1. **Allez dans Facebook Developer Console**
2. **Webhooks → Modifier le webhook "feed"**
3. **Vérifiez l'URL** : doit être `https://www.gdr-innovation.fr/api/facebook/webhook` (SANS :3443)
4. **Sauvegardez**
5. **Cliquez sur "Tester"**
6. **Regardez les logs Apache en temps réel** :
   ```powershell
   Get-Content C:\xampp\apache\logs\gdri-ssl-access.log -Wait -Tail 20
   ```

Si vous voyez un POST apparaître → Le problème est résolu !
Si vous ne voyez toujours rien → Le problème vient d'ailleurs.
