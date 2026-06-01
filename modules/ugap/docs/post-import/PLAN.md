# Onglets post-import — plan de reprise

> **Méthode** : même gouvernance que [`docs/onglet-import/PLAN.md`](../onglet-import/PLAN.md) — décrire → **valider** → coder → **tester** dans `admin.php`.  
> **Prérequis** : workflow Import utilisable (étapes 1–7 testées au besoin ; bugs bloquants corrigés au fil de l’eau).

**URL test** : `/modules/ugap/frontend/admin.php`

**Admin** : `admin.php` uniquement (fichier `admin.html` supprimé).

---

## Ordre des onglets (navigation admin)

| # | Onglet | Partial | Phase STRUCTURE | Plan détaillé | Priorité |
|---|--------|---------|-----------------|---------------|----------|
| — | Import | `tab-import.php` | 1 | `docs/onglet-import/` | En cours / stabilisation |
| 1 | **Famille** | `tab-famille.php` | 3 | [`docs/onglet-famille/PLAN.md`](../onglet-famille/PLAN.md) | **Prochain** |
| 2 | **Options** | `tab-options.php` | 3 | `docs/onglet-options/PLAN.md` (à créer) | Après Famille |
| 3 | Template bateau | `tab-template-bateau.php` | 2 | — | Si besoin avant modèles |
| 4 | Modèles | `tab-models.php` | 2 | — | Vue LC déjà partielle |
| 5 | **Template bateau** | `tab-template-bateau.php` | 2 | `docs/onglet-categorie/PLAN.md` | Parcours configurateur + arbre (remplace l’onglet Catégorie UI) |
| 6 | Vues métier | `tab-categories.php` | 3 | — | Vues métier Excel / tableau |
| — | Structured / Couplings | masqués nav | 3 | Plus tard |
| — | Prompts IA | `ugap.php` principal | 5 | Hors admin embed |

**Règle métier** : les **familles catalogue** (onglet Famille) sont **hors périmètre import** — elles travaillent sur `currentData` après publication / chargement catalogue, pas sur le staging Excel seul.

---

## Dettes connues (état 2026-05)

| Zone | Fichier | Lignes ~ | Action |
|------|---------|----------|--------|
| Admin JS inline | `admin.php` | ~18k | Extraire par onglet, ne pas agrandir |
| Famille UI | `admin.php` + `tabs/famille-tab.js` | ~3k + ~525 | Déléguer legacy → extraire progressivement |
| Options | `admin.php` | (dispersé) | `assets/js/tabs/options-tab.js` cible |
| API catalogue | `ugapController.js` | monolithe | `ugapCatalogController.js` à terme |

**Déjà extrait (import)** : `assets/js/import/*`, `shared/ugap-api.js`.

**Déjà extrait (famille, partiel)** : `assets/js/tabs/famille-tab.js` — cartes + drag ; cœur métier encore dans `admin.php` (`__legacyRenderFamilleTabInner`, `runFamilleTraitement`, état `__ugapFamilleReview`).

---

## API backend (catalogue / familles)

Source : `backend/routes.js` — à documenter fonction par fonction avant changement.

| Route | Rôle | Onglet |
|-------|------|--------|
| `GET/PUT /ui-state` | `families`, `familleHeuristicRules`, `optionStatuses` | Famille, Options |
| `GET/PUT /data` | Catalogue complet | Tous |
| `POST /familles/suggest-ia` | Suggestion groupes familles (IA) | Famille |
| `POST /familles/assign-views-ia` | Famille → vue métier (IA) | Famille + Vues métier |
| `POST /options/assign-families-bulk` | Assignation familles en masse | Options |

---

## Ordre de travail recommandé

1. **Valider** ce fichier + ordre onglets 1→2→5 avec vous.
2. **Onglet Famille** — inventaire fonctions dans `docs/onglet-famille/PLAN.md` → validation bloc par bloc → extraction JS.
3. **Onglet Options** — créer `docs/onglet-options/PLAN.md` sur le même modèle.
4. **Vues métier** — une fois familles validées et assignées.
5. Factoriser `ugap-api.js` / état catalogue partagé si duplication import ↔ post-import.

---

## Session en direct (checklist commune)

- [ ] Backend `node server.js` + entreprise UGAP chargée
- [ ] Catalogue avec options (import publié ou données existantes)
- [ ] Onglet cible actif, console sans erreur rouge
- [ ] Sauvegarde `ui-state` / `data` testée après action

---

## Lien Import → post-import

Après **Publier** (étape 7 import) : `currentData` est alimenté ; onglets Famille / Options utilisent les **options catalogue** (`currentData.categories`), pas le document staging seul.

Tests Famille utiles : jeu avec variantes couleur / équipements multiples, minorations liées, familles déjà partiellement validées en `ui-state`.
