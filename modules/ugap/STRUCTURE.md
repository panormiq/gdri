# Module UGAP — structure, dettes et plan de reprise

> Complète `CONVENTIONS.md`.

## Méthode actuelle (2026-05-22)

**Paramétrage v2** — l’ancien admin est **legacy** (`frontend/_old/`). Tout nouveau code : `frontend/parametrage/`.

1. Plan : [`docs/onglet-parametrage/PLAN.md`](docs/onglet-parametrage/PLAN.md)
2. Décrire **chaque fonction** → valider avant de coder (`CONVENTIONS.md` §5).
3. Petits fichiers sous `parametrage/assets/js/<onglet>/` → test `ugap.php?tab=parametrage`.
4. Legacy inchangé sauf correctif bloquant.

**Prochain** : **Import v2** (reprise propre de `docs/onglet-import/PLAN.md`).

---

**Dernière revue** : 2026-05-20

---

## Vue d’ensemble

| Couche | Rôle | Point CONVENTIONS §8 |
|--------|------|----------------------|
| `backend/routes.js` | Déclaration routes `/api/ugap/*` | Tous |
| `backend/controllers/ugapController.js` | Handlers HTTP (monolithe) | Tous |
| `backend/services/*` | Métier Mongo, Excel, IA, import | Par domaine |
| `frontend/parametrage/index.php` | **Paramétrage v2** (actif) | tous |
| `frontend/_old/admin.php` | Admin legacy (figé) | — |
| `frontend/admin.php` | Routeur → v2 ou legacy | — |
| `frontend/index.html` | Configurateur public | 6 |
| `frontend/partials/tabs/*` | Markup legacy (inclus par `_old/admin.php`) | — |
| `frontend/assets/js/admin/admin-legacy.js` | JS legacy (~16k) | — |
| `frontend/parametrage/assets/js/*` | JS v2 par onglet | tous |

**Entrée paramétrage prod** : `/modules/ugap/frontend/parametrage/index.php`  
**Legacy** : `/modules/ugap/frontend/_old/admin.php`

**Backend GDRI** : `backend/server.js` charge `modules/ugap/backend/index.js` → préfixe `/api/ugap`.

**IA** : frontend → `/api/ia/*` ; métier prompts UGAP → `UgapAIService.js` (pas `backendIA/`).

---

## Fichiers critiques (hors `node_modules`)

| Fichier | Lignes ~ | Statut vs conventions |
|---------|----------|------------------------|
| `frontend/admin.php` | **~190** | Coque PHP + partials ; logique → `assets/js/admin/admin-legacy.js` |
| `frontend/assets/js/admin/admin-legacy.js` | **~16 800** | Logique admin (ex-inline) — à découper par onglet |
| ~~`frontend/admin.html`~~ | — | Supprimé |
| `frontend/assets/js/ugap-import-minorations-workflow.js` | **3 486** | À découper (phase 4) |
| `backend/controllers/ugapController.js` | **3 337** | À découper par domaine |
| `backend/services/UgapDataService.js` | **2 976** | À découper (catalogue / staging / ui-state) |
| `frontend/index.html` | **1 778** | Phase 6 |
| `backend/services/UgapAIService.js` | **1 598** | Phase 5 |
| `backend/routes.js` | **848** | Acceptable ; garder déclaratif |
| `backend/services/UgapExcelService.js` | **812** | Phase 1 — surveiller |
| `frontend/assets/js/ugap-import-tab.js` | **290** | Phase 1 — OK taille |
| `backend/services/UgapImportAssignmentService.js` | **353** | Phase 1 |
| `frontend/assets/js/templates/ugap-view-templates.js` | **415** | Phases 2–3 |

**Règle** : objectif **200–500 lignes** par fichier cible ; au-delà → découpage + en-tête commenté (§4 CONVENTIONS).

---

## Backend — services existants

| Service | Rôle approximatif | Phase |
|---------|-------------------|-------|
| `UgapExcelService.js` | Import / lecture Excel | 1 |
| `ExcelTableDetector.js` | Détection blocs tableaux | 1 |
| `UgapImportAssignmentService.js` | Assignations staging | 1 |
| `UgapDataService.js` | Persistance Mongo (tout le catalogue) | 1–3 |
| `UgapAIService.js` | Appels IA métier UGAP | 5 |
| `UgapPdfService.js` | PDF configurations | 2 |
| `PdfToExcelConverter.js` | PDF → Excel | 2 |
| `PythonExtractionServer.js` | Pont extraction Python | 2 |
| `ExcelExtractionTester.js` | Tests extraction | 2 |
| `WebSearchSimulator.js` | Simu recherche (dev) | — |

**Réutilisation** : toute nouvelle logique doit passer par ces services — pas de duplication dans le controller ou `admin.php`.

---

## Backend — cible controllers (à créer progressivement)

Remplacer le monolithe `ugapController.js` par des fichiers ~200–400 lignes, réexportés depuis `controllers/index.js` :

```
backend/controllers/
  index.js                 # fusion des exports (compat routes.js)
  ugapImportController.js  # import, staging, publish, audit
  ugapCatalogController.js # models, categories, options, familles
  ugapDevisController.js   # generateDevis, ui-state
  ugapPromptsController.js # prompts, ia-context
  ugapConfigController.js  # configurations modèle, PDF, Excel map
  ugapToolsController.js     # convert-pdf, download-excel, health
```

`routes.js` continue d’importer un seul objet ; **pas de changement d’URL**.

---

## Frontend admin — onglets (partials)

Inclus depuis `admin.php` (~l.135+) :

| Partial | Phase |
|---------|-------|
| `tab-navigation.php` | — |
| `tab-import.php` | **1** |
| `tab-famille.php` | 3 |
| `tab-options.php` | 3 |
| `tab-template-bateau.php` | 2 |
| `tab-models.php` | **2** |
| `tab-categorie.php` | **3** |
| `tab-categories.php` | **3** (vues métier) |
| `tab-structured.php` | 3 |
| `tab-couplings.php` | 3 |
| `tab-prompts.php` | **5** |
| `extraction/subtab-*.php` | 1–2 |
| `prompts/subtab-*.php` | 5 |

**Scripts externes déjà extraits** (à étendre) :

- `assets/js/templates/ugap-view-templates.js`
- `assets/js/ugap-import-tab.js`
- `assets/js/ugap-import-minorations-workflow.js`
- `assets/js/tabs/famille-tab.js`
- `assets/js/tabs/famille-state.js` (état familles / ui-state — bloc A)

**Cible** : `admin.php` = coque HTML + `require` partials + liste `<script src>` — **pas de milliers de lignes de JS inline**.

**Utilitaires partagés à factoriser** (un seul endroit) :

- `assets/js/shared/ugap-api.js` — `fetch` JWT, gestion erreurs JSON
- `assets/js/shared/ugap-dom.js` — alerts, modals, tabs
- `assets/js/shared/ugap-format.js` — prix, libellés

---

## Routes API (source de vérité)

Fichier : `backend/routes.js` (~70 handlers → `ugapController.*`).

Domaines :

1. **Import** : `/import`, `/imports/staging/*`, `/import-audit/*`
2. **Catalogue** : `/data`, `/models`, `/categories`, `/options`, `/familles/*`
3. **Devis** : `/devis`, `/ui-state`
4. **IA admin** : `/prompts`, `/ia-context`, `/improve-categorization`, `/ai/verify-option`, `*-ia`
5. **Config modèle** : `/models/:id/configurations/*` (PDF, Excel, map, extract)
6. **Outils** : `/convert-pdf-to-excel`, `/download-excel/*`, `/health`

---

## Phases historiques (référence — remplacées par onglets)

<details>
<summary>Ancien découpage par phases techniques</summary>

### Phase 1 — Import / staging Excel

**Objectif** : pipeline import lisible, fichiers < 500 lignes, JS admin import hors de `admin.php`.

| Action | Fichiers |
|--------|----------|
| Découper | `ugap-import-minorations-workflow.js` → `import/minorations-*.js` |
| Extraire JS | Blocs import de `admin.php` → `assets/js/import/` |
| Découper backend | `ugapImportController.js` + tranches `UgapDataService` staging |
| En-têtes | Tous fichiers touchés |
| Ne pas toucher | `index.html`, prompts, categories |

### Phase 2 — Modèles & configurations

- `tab-models.php`, `tab-template-bateau.php`, extraction subtabs modèle
- `ugapConfigController.js`, `UgapPdfService`, configs dans `UgapDataService`

### Phase 3 — Catégories / options / familles

- `tab-categories.php`, `tab-options.php`, `tab-famille.php`, `famille-tab.js`
- `ugapCatalogController.js`

### Phase 4 — Minorations / majorations

- Suite workflow import (déjà partiellement dans minorations-workflow.js)

### Phase 5 — Prompts & IA

- `tab-prompts.php`, `UgapAIService.js` découpé
- `ugapPromptsController.js`

### Phase 6 — Configurateur

- `index.html` découpé + JS modules

### Transverse (chaque phase)

- [ ] En-tête commenté sur chaque fichier modifié
- [ ] Réutiliser `ugap-api.js` au lieu de copier `fetch`
- [x] `admin.html` supprimé — entrée unique `admin.php`
- [ ] Pas de nouvelle route sans entrée dans `routes.js`

</details>

---

## Fichiers à ne pas confondre

| Fichier | Note |
|---------|------|
| `admin.php` | **Interface admin utilisée** (partials + JS inline) |
| `admin.php` | Interface admin unique |
| `_restore_admin_integration.js` | Script de secours — pas prod |
| `backend/debug_excel.js`, `test-*.js` | Dev uniquement |

---

## Documentation liée

- `CONVENTIONS.md` — règles IA / dev
- `README.md` — install & API résumée
- `CHEMINS-IMPORTS.md` — `../../../` vers `backend/`
- `TROUBLESHOOTING.md` — Apache / 503

---

## Pour l’IA : démarrer une tâche

1. Lire `CONVENTIONS.md` + ce fichier.
2. Confirmer la **phase** (1–6) avec l’utilisateur.
3. Lister les fichiers de la phase **avant** de coder.
4. Appliquer découpage + en-têtes + réutilisation — **un PR logique = une phase partielle**.
