# UGAP — code legacy (figé)

**Ne plus développer ici.** Toute évolution du paramétrage se fait sous `../parametrage/`.

## Contenu

| Fichier | Rôle |
|---------|------|
| `admin.php` | Ancien back-office complet (iframe GDRI + accès direct) |

## Scripts et partials (hors `_old/`)

Le legacy charge encore :

- `../assets/js/admin/admin-legacy.js` (~16k lignes)
- `../partials/tabs/*`
- modules `import/`, `tabs/`, `shared/` extraits partiellement

Ces fichiers restent en place pour ne pas casser les URLs tant que le v2 ne les remplace pas onglet par onglet.

## Accès

- Direct : `/modules/ugap/frontend/_old/admin.php`
- Via routeur : `/modules/ugap/frontend/admin.php?legacy=1`
- Prompts IA (GDRI) : `_old/admin.php?embedded=1&ugapView=prompts`

## Plan de remplacement

`docs/onglet-parametrage/PLAN.md`
