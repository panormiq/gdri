# Correction de la session après redirection OAuth

## Problème identifié

Après la redirection OAuth depuis Facebook, l'utilisateur était déconnecté et redirigé vers la page d'accueil.

## Cause

Le cookie de session PHP était configuré avec `SameSite=Strict`, ce qui empêche l'envoi du cookie lors des redirections depuis des domaines externes (comme Facebook).

## Corrections appliquées

### 1. Modification de `session.cookie_samesite` (✅)

**Fichier** : `frontend/auth/session.php`

**Changement** :
- ❌ `session.cookie_samesite = 'Strict'`
- ✅ `session.cookie_samesite = 'Lax'`

**Explication** :
- `Lax` permet l'envoi du cookie lors des redirections GET depuis des domaines externes (comme les redirections OAuth)
- `Lax` reste sécurisé : le cookie n'est envoyé que pour les requêtes GET de navigation, pas pour les requêtes POST cross-site

### 2. Vérification de session perdue (✅)

**Fichier** : `frontend/pages/modules/facebook-config.php`

Ajout d'une vérification pour détecter si la session est perdue après la redirection OAuth et rediriger vers le dashboard avec un message.

## Test

1. **Se connecter** à GDRI
2. **Aller** sur la page de configuration Facebook
3. **Cliquer** sur "Se connecter avec Facebook"
4. **Autoriser** l'application dans Facebook
5. **Vérifier** que vous êtes toujours connecté et revenez sur la page de configuration Facebook

## Résultat attendu

✅ La session PHP est maintenue après la redirection OAuth
✅ L'utilisateur reste connecté à son compte GDRI
✅ La redirection vers la page de configuration Facebook fonctionne correctement
