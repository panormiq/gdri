# Correction des webhooks Facebook

## Problèmes identifiés

### 1. "mentions" doit être "mention" (singulier)
L'API Facebook Graph utilise `mention` (singulier) et non `mentions` (pluriel).

**Erreur** :
```
Erreur 400: Param subscribed_fields[0] must be one of {feed, mention, ...} - got "mentions"
```

**Correction** : Utiliser `mention` au lieu de `mentions`

### 2. "messages" nécessite la permission `pages_messaging`
L'abonnement au webhook `messages` nécessite la permission avancée `pages_messaging` qui n'est pas incluse dans les scopes OAuth par défaut.

**Erreur** :
```
Erreur 403: (#200) To subscribe to the messages field, one of these permissions is needed: pages_messaging
```

**Solution** : 
- Pour activer `messages`, il faut demander la permission `pages_messaging` dans Facebook Developer
- Cette permission nécessite une révision d'app par Facebook
- En attendant, seuls `feed` et `mention` fonctionnent

## Corrections appliquées

1. ✅ Changement de `mentions` en `mention` dans l'interface
2. ✅ Normalisation automatique dans le backend (compatibilité)
3. ✅ Message d'aide pour `messages` expliquant la nécessité de `pages_messaging`
4. ✅ Mise à jour de l'abonnement automatique lors de la connexion OAuth

## Webhooks disponibles

### Fonctionnels (sans permission spéciale)
- ✅ **feed** : Posts et commentaires sur la page
- ✅ **mention** : Mentions de la page dans des posts/commentaires

### Nécessite permission avancée
- ⚠️ **messages** : Messages privés (nécessite `pages_messaging`)

## Pour activer "messages"

1. Aller dans Facebook Developer → Votre App → Produits → Facebook Login → Paramètres
2. Ajouter la permission `pages_messaging` dans "Autorisations et fonctionnalités"
3. Soumettre l'app pour révision (Facebook doit approuver cette permission)
4. Une fois approuvé, mettre à jour les scopes OAuth dans le code pour inclure `pages_messaging`
