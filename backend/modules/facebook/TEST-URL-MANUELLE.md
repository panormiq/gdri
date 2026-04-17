# Comment Tester l'URL du Webhook Manuellement

## ⚠️ Pourquoi "Forbidden" ?

Quand vous tapez juste :
```
https://www.gdr-innovation.fr/api/facebook/webhook
```

Vous recevez **403 Forbidden** car :
1. La route GET `/webhook` **vérifie le token** de sécurité
2. Sans les paramètres corrects, elle rejette la requête (sécurité)
3. C'est **normal et attendu** ✅

## ✅ Comment Tester Correctement

### Test 1 : Vérification du Webhook (GET)

Tapez dans votre navigateur :
```
https://www.gdr-innovation.fr/api/facebook/webhook?hub.mode=subscribe&hub.verify_token=gdri_facebook_webhook_token_2024&hub.challenge=test123
```

**Résultat attendu** : Vous devriez voir `test123` dans la réponse (pas "Forbidden")

### Test 2 : Sans Token (Doit Donner 403)

Tapez :
```
https://www.gdr-innovation.fr/api/facebook/webhook
```

**Résultat attendu** : `403 Forbidden` ✅ (c'est normal, sécurité)

### Test 3 : Avec Mauvais Token (Doit Donner 403)

Tapez :
```
https://www.gdr-innovation.fr/api/facebook/webhook?hub.mode=subscribe&hub.verify_token=MAUVAIS_TOKEN&hub.challenge=test123
```

**Résultat attendu** : `403 Forbidden` ✅ (c'est normal, sécurité)

## 🔍 Vérifier dans la Console

Quand vous testez, regardez la console du serveur GDRI. Vous devriez voir :

### Si le test est correct :
```
🔔🔔🔔 ===== WEBHOOK GET (VERIFICATION) RECU =====
  ✅✅✅ Webhook Facebook vérifié avec succès
  ✅ Réponse 200 envoyée
```

### Si le test échoue (403) :
```
🔔🔔🔔 ===== WEBHOOK GET (VERIFICATION) RECU =====
  ❌❌❌ Échec de vérification du webhook
    - mode === "subscribe": false (ou true)
    - token correspond: false
  ❌ Réponse 403 envoyée
```

## 📊 Résumé

| URL | Résultat | Normal ? |
|-----|----------|----------|
| `/api/facebook/webhook` (sans paramètres) | 403 Forbidden | ✅ Oui |
| `/api/facebook/webhook?hub.mode=subscribe&hub.verify_token=MAUVAIS&hub.challenge=test` | 403 Forbidden | ✅ Oui |
| `/api/facebook/webhook?hub.mode=subscribe&hub.verify_token=gdri_facebook_webhook_token_2024&hub.challenge=test123` | `test123` (200 OK) | ✅ Oui |

## 💡 Conclusion

**Le "Forbidden" est normal** si vous n'avez pas les bons paramètres. C'est une **sécurité** pour empêcher n'importe qui d'accéder au webhook.

Pour tester correctement, utilisez l'URL complète avec les paramètres de vérification.
