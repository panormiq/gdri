# Module UGAP — conventions et consignes (IA & développeurs)

> **Lire ce fichier avant toute modification** dans `modules/ugap/`.  
> Objectif : éviter les hallucinations, les gros fichiers monolithiques et les refactors hors périmètre.

---

## Règles obligatoires

### 1. Taille des fichiers

- **Maximum quelques centaines de lignes** par fichier (ordre de grandeur : 200–500 ; hors en-tête commenté).
- Si un fichier dépasse nettement ce seuil → **découper** en plusieurs fichiers, pas tout regrouper dans un seul bloc.
- **Ne pas** recréer de monolithes (`admin.php` à 19k lignes est une dette connue — ne pas l’aggraver, le découper progressivement).

### 2. Un fichier = une responsabilité

- **Un fichier** = **une fonction** OU un **petit regroupement de fonctions directement liées** (même flux, même domaine).
- Exemples valides :
  - `detectTablesFromWorksheet.js` → détection tableaux Excel uniquement.
  - `ugap-import-staging-list.js` → chargement liste staging uniquement.
- Exemples interdits :
  - Un fichier qui mélange import Excel + routes API + rendu admin + prompts IA.

### 3. Réutiliser au maximum le code existant

- **Avant d’écrire du nouveau code** : chercher dans `modules/ugap/` (et si pertinent `backend/`, `frontend/`) une fonction, un service ou un utilitaire déjà présent.
- **Préférer** : étendre, importer ou factoriser l’existant — plutôt que copier-coller ou réimplémenter la même logique.
- **Factoriser** ce qui est utilisé à **2 endroits ou plus** dans un fichier partagé dédié (`utils/`, `shared/`, service commun) avec en-tête commenté.
- **Ne pas dupliquer** : appels API, parsing Excel, accès Mongo, helpers DOM, formatage — **un seul endroit** par comportement (voir aussi section anti-hallucination).
- Les nouveaux fichiers doivent **s’appuyer** sur l’existant ; la duplication est une dette à corriger, pas à augmenter.

### 4. Commentaire d’en-tête obligatoire dans chaque fichier

**Chaque fichier** (`.js`, `.php`, `.html` partiel si logique) doit commencer par un bloc commentaire qui décrit **exactement** :

```text
/**
 * FICHIER : chemin/relatif/nomFichier.ext
 * RÔLE : une phrase — ce que ce fichier fait et ne fait pas.
 *
 * ENTRÉES : d’où viennent les données (API, DOM, Mongo, fichier…)
 * SORTIES : ce qui est retourné / modifié / affiché
 *
 * DÉPEND DE : liste des autres fichiers/modules appelés
 * NE PAS : liste explicite de ce qu’il ne faut pas ajouter ici (anti-hallucination)
 *
 * APPELÉ PAR : qui utilise ce fichier
 */
```

L’IA et les humains doivent pouvoir comprendre le fichier **sans lire tout le code**.

### 5. Valider la description avant de coder (obligatoire)

Pour **chaque fichier** et **chaque fonction** à créer ou réécrire :

1. Rédiger la description (en-tête fichier ou commentaire fonction) : rôle, entrées, sorties, ce que ça ne fait pas.
2. **Soumettre à validation** (utilisateur ou note dans le plan d’onglet, ex. `docs/onglet-import/PLAN.md`) — statut `📝 à valider`.
3. **Ne pas coder** tant que la description n’est pas **validée** (`✅ validé`).
4. Après code : test en direct dans l’admin → statut `🧪 testé OK`.

L’IA doit proposer les descriptions **fonction par fonction** en s’appuyant sur le code existant extrait, sans inventer de comportement.

### 6. Avant de coder

1. Lire ce fichier (`CONVENTIONS.md`) et le plan de l’onglet en cours (`docs/onglet-*/PLAN.md`).
2. Lire l’en-tête du fichier cible.
3. Si la tâche dépasse le rôle du fichier → **nouveau fichier** + mise à jour des `DÉPEND DE` / `APPELÉ PAR`.
4. **Ne pas inventer** de routes, collections Mongo, champs JSON ou onglets UI non documentés ailleurs.

### 7. Périmètre module

| Zone | Chemin | Rôle |
|------|--------|------|
| API Node | `modules/ugap/backend/` | Routes `/api/ugap/*`, services, Mongo entreprise |
| Paramétrage v2 | `parametrage/` + `assets/js/shared/ugap-api.js` | Back-office actif |
| Admin legacy | `_old/admin.php` + `admin-legacy.js` + `partials/` | Figé — secours uniquement |
| Configurateur | `modules/ugap/frontend/index.html` | Parcours utilisateur devis |
| IA | Appels `/api/ia/*` depuis le frontend ; logique métier UGAP dans `UgapAIService.js` | Pas de logique UGAP métier dans `backendIA/` |
| Core GDRI | `backend/` (racine) | JWT, DB, chargement module — **3 niveaux** `../../../` depuis `modules/ugap/backend/` |

### 8. Ce qu’il ne faut pas faire (anti-hallucination)

- Inventer des endpoints non listés dans `backend/routes.js`.
- Supposer le schéma Mongo sans lire `UgapDataService.js` ou la doc existante.
- Dupliquer la logique Excel dans plusieurs services — **un seul endroit** par étape du pipeline.
- Modifier `backendIA/` pour des besoins UGAP spécifiques.
- L’admin UGAP est servi uniquement via `parametrage/index.php` (legacy : `_old/admin.php`).
- Ajouter des fonctionnalités « au feeling » non demandées par l’utilisateur.

### 9. Paramétrage v2 (depuis 2026-05-22)

**Legacy figé** (`_old/admin.php`). **Actif** : `parametrage/` — réécrire onglet par onglet :

1. Extraire le comportement actuel (grep / lecture ciblée — pas tout le monolithe d’un coup).
2. Lister chaque fonction avec description → **valider** (§5).
3. Implémenter dans de **`parametrage/assets/js/<onglet>/`** ; tester **en direct** dans l’admin.
4. Ne pas rebrancher l’`admin-legacy.js` dans le v2.

**Ordre** :

| # | Onglet | Plan détaillé |
|---|--------|----------------|
| 1 | **Import v2** | `docs/onglet-import/PLAN.md` (réimplémentation) |
| 2–7 | Famille, Options, … | `docs/onglet-parametrage/PLAN.md` |
| — | Configurateur | `index.html` (hors paramétrage) |

---

## Fichiers de référence (humains)

- `STRUCTURE.md` — état des lieux et dettes  
- `docs/onglet-parametrage/PLAN.md` — **paramétrage v2** (ordre onglets, coupure legacy)
- `docs/onglet-import/PLAN.md` — référence métier Import (à réimplémenter en v2)  
- `README.md` — installation, structure, API résumée  
- `CHEMINS-IMPORTS.md` — `require('../../../...')` depuis le module  
- `TROUBLESHOOTING.md` — Apache / proxy / 503  

---

## Pour l’IA Cursor

1. Coder sous **`parametrage/`** (section 9) — **Import v2** en premier ; qu’il n’est pas terminé.  
2. **Valider les descriptions** avant tout code (section 5).  
3. **Réutiliser** services/backend existants (section 3) — extraire, ne pas réinventer.  
4. Tester **en direct** après chaque fonction ou petit bloc.  
5. Anti-hallucination (section 8).
