# Correction des redirections OAuth Facebook

## Problème identifié

Le callback OAuth redirigeait vers `/pages/modules/facebook-config.php` mais le chemin réel est `/frontend/pages/modules/facebook-config.php`, ce qui causait un "Forbidden" d'Apache.

## Corrections appliquées

Toutes les redirections dans `backend/modules/facebook/routes.js` ont été corrigées pour inclure `/frontend/` :

- ❌ `/pages/modules/facebook-config.php`
- ✅ `/frontend/pages/modules/facebook-config.php`

### Routes corrigées

1. **GET /api/facebook/oauth/callback** :
   - Toutes les redirections d'erreur
   - Redirection de succès (page unique)
   - Redirection de sélection (pages multiples)

## Test

1. **Redémarrer Node.js** pour appliquer les changements
2. **Tester le flux OAuth** depuis Facebook
3. **Vérifier** que la redirection fonctionne correctement

## URLs corrigées

- ✅ `/frontend/pages/modules/facebook-config.php?error=...`
- ✅ `/frontend/pages/modules/facebook-config.php?success=connected&pageId=...`
- ✅ `/frontend/pages/modules/facebook-config.php?state=...&step=select_page`
