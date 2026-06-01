# Onglet Import — plan de réécriture

> **Méthode** : extraire le comportement actuel → décrire chaque fonction → **validation humaine** → coder → **test en direct** dans l’admin.  
> Statut par fonction : `⬜ à décrire` | `📝 à valider` | `✅ validé` | `💻 codé` | `🧪 testé OK`

**URL test** : `/modules/ugap/frontend/admin.php` → onglet **Import**

**Ne pas modifier** les autres onglets tant que cet onglet n’est pas stable (sauf correctifs bloquants). Suite post-import : [`docs/post-import/PLAN.md`](../post-import/PLAN.md).

---

## Fichiers cibles (après réécriture)

| Fichier | Rôle |
|---------|------|
| `partials/tabs/tab-import.php` | HTML uniquement (IDs stables) |
| `assets/js/shared/ugap-api.js` | `apiCall`, `showAlert`, `escapeHtml` |
| `assets/js/import/import-list.js` | Liste staging, renommage, ouvrir éditeur |
| `assets/js/import/import-workflow-shell.js` | Steps, indicateur, `switchImportWorkflowStep` |
| `assets/js/import/import-models-step.js` | Étape 1 modèles |
| `assets/js/import/import-minorations-step.js` | Étape 2 minorations — **extrait** (rendu + auto-seed ; save reste workflow-steps) |
| `assets/js/import/import-majorations-step.js` | Étape 3 majorations |
| `assets/js/import/import-base-options-step.js` | Étape 4 options de base (après mino/majo) |
| `assets/js/import/import-options-tri-step.js` | Étape 5 options / tri |
| `assets/js/import/import-pr-step.js` | Étape 6 PR |
| `assets/js/import/import-validate-step.js` | Étape 7 publier |
| `backend/controllers/ugapImportController.js` | API import (existant — revue fonction par fonction) |
| `backend/services/UgapExcelService.js` | Extraction Excel (réutiliser, pas réécrire sans besoin) |
| `backend/services/UgapDataService.js` | Staging Mongo (méthodes import uniquement extraites à terme) |

**Source actuelle à miner** (ne pas tout recopier) :

- `admin.php` — fonctions `import*`, `renderImport*`, `switchImport*`, …
- `ugap-import-tab.js` — liste
- `ugap-import-minorations-workflow.js` — étapes 2–4 (3 486 lignes)

---

## API backend (source : `routes.js` + `ugapImportController.js`)

| Route | Handler | Statut |
|-------|---------|--------|
| `POST /import` | `importExcel` | 📝 à valider |
| `GET /imports/staging` | `getImportStaging` | 📝 à valider |
| `GET /imports/staging/list` | `listImportStaging` | 📝 à valider |
| `PATCH /imports/staging/:id` | `renameImportStaging` | 📝 à valider |
| `POST .../validate-models` | `validateImportModels` | 📝 à valider |
| `POST .../validate-options` | `validateImportOptions` | 📝 à valider |
| `POST .../apply-assignments` | `applyImportAssignments` | 📝 à valider |
| `POST .../minorations` | `updateImportMinorations` | 📝 à valider |
| `POST .../majorations` | `updateImportMajorations` | 📝 à valider |
| `POST .../options-tri` | `updateImportOptionsTri` | 📝 à valider |
| `POST .../base-products` | `updateImportBaseProducts` | 📝 à valider |
| `POST .../publish` | `publishImport` | 📝 à valider |
| `GET /import-audit` | `getImportAudit` | 📝 à valider |
| `POST /import-audit/reintegrate` | `reintegrateImportAuditLine` | 📝 à valider |
| `POST .../reopen` | `reopenImportStaging` | 📝 à valider |

Pour chaque handler : documenter **entrée body/query**, **champs Mongo touchés**, **réponse JSON** — puis valider avec vous avant tout changement de code.

---

## Frontend — bloc A : liste des imports ✅

| Fonction | Description proposée | Fichier cible | Statut |
|----------|---------------------|---------------|--------|
| `loadImportList` | Charge `GET /imports/staging/list`, remplit le tableau | `import-list.js` | 🧪 testé OK |
| `renderImportListTable` | Rend les lignes (nom, statut, date, progression, bouton Éditer) | `import-list.js` | 🧪 testé OK |
| `saveImportDisplayName` | `PATCH` renommage inline | `import-list.js` | 🧪 testé OK |
| `reopenImportIfPublished` | Si statut `published`, `POST .../reopen` avant édition | `import-list.js` | 🧪 testé OK |
| `openImportEditor` | Charge staging, passe en mode éditeur, reprend l’étape | `import-list.js` | 🧪 testé OK |
| `closeImportEditor` | Retour liste, reset `currentImportStaging` | `import-list.js` | 🧪 testé OK |
| `setImportViewMode` | Bascule `#import-list-section` / `#import-editor-section` | `import-list.js` | 🧪 testé OK |
| `initImportTab` | Bind events, premier `loadImportList` | `import-list.js` | 🧪 testé OK |

**Test manuel** : liste charge → renommer → ouvrir import brouillon → retour liste — **OK (2026-05-21)**.

---

## Frontend — bloc B : coque workflow (`import-workflow-shell.js`) ✅

| Fonction | Rôle | Statut |
|----------|------|--------|
| `renderImportStagingIndicator` | Badge + meta + progression | 🧪 testé OK |
| `switchImportWorkflowStep` | Navigation étapes 1–7 | 🧪 testé OK |
| `renderImportWorkflow` | Délègue aux renderers d’étapes | 🧪 testé OK |
| `refreshImportStagingIndicator` | Recharge staging API | 🧪 testé OK |
| `ensureImportTabVisible` | Active onglet Import | 🧪 testé OK |
| `bindImportWorkflowStepButtons` | Clics boutons étapes | 🧪 testé OK |

`admin.php` : délégation via `ugapRenderImportWorkflow` / `ugapRefreshImportStagingIndicator` (plus de doublons shell).

Reste dans `admin.php` : `applyImportStagingToCurrentData`, `importExcel`, `runImportAudit`. Étapes 5–7 : `import-workflow-steps.js` + `import-workflow-shell.js` (options tri, PR, validation).

**Test manuel** : ouvrir un import → cliquer étapes 1→7 — **OK (2026-05-21)**.

---

## Frontend — étapes workflow (sous-onglets)

| Étape | Fichier actuel | Statut | Suite |
|-------|----------------|--------|-------|
| 1 Modèles | `import-models-step.js` | 🧪 testé OK | — |
| 2 Minorations | `import-minorations-step.js` (+ shared dans workflow-steps) | 💻 extrait | 🧪 test ← **en cours** |
| 3 Majorations | `import-workflow-steps.js` | 💻 | idem |
| 4 Options de base | `import-workflow-steps.js` | 💻 | cache sync `_importBpSyncFingerprint` (réouverture étape) |
| 5 Options / tri | `import-workflow-steps.js` + admin legacy | 💻 | découper + 🧪 |
| 6 PR | idem | 💻 | découper + 🧪 |
| 7 Valider | idem | 💻 | découper + 🧪 |

`import-workflow-steps.js` = ancien `ugap-import-minorations-workflow.js` renommé (~3,5k lignes) — **à découper progressivement** en fichiers &lt; 500 lignes.

---

## Ordre de travail recommandé

1. ~~**Valider** les descriptions du bloc A~~ ✅  
2. ~~Bloc A~~ — `import-list.js` → **🧪 testé OK** (2026-05-21)  
3. ~~**Bloc B**~~ — `import-workflow-shell.js` → **🧪 testé OK** (2026-05-21)  
4. ~~**Étape 1**~~ — `import-models-step.js` → **🧪 testé OK** (2026-05-21)  
5. **Étapes 2–7** — `import-workflow-steps.js` → **🧪 test** ← **ici**  
6. Découper : `import-assign-shared.js` (mino+majo) → `import-minorations-step.js`, `import-majorations-step.js`, etc.

---

## Frontend — étape 1 : modèles (`import-models-step.js`) ✅

| Fonction | Statut |
|----------|--------|
| `renderImportModelsStepHtml` | 🧪 testé OK |
| `validateImportModelsStep` | 🧪 testé OK |
| `importModelRowDisplayValidated` | 🧪 testé OK |
| `toggleImportModelSelection`, `selectAllImportModelsVisible`, filtres, prix | 🧪 testé OK |

**Test manuel** : OK (2026-05-21). Doublons retirés de `admin.php`.

---

## Frontend — étapes 2–7 : test manuel (`import-workflow-steps.js`) ← **en cours**

| # | Étape | Actions à vérifier |
|---|--------|-------------------|
| 2 | Minorations | Tableau MINO → pré-cocher postes → enregistrer → badge / reprise OK |
| 3 | Majorations | Idem majorations → enregistrer → accès étape 4 débloqué |
| 4 | Options de base | Registre options de base → prix / postes → enregistrer |
| 5 | Options / tri | Types option/mino/majo → postes P1–P10 → enregistrer |
| 6 | PR | (si lignes PR) affichage / exclusion des autres étapes |
| 7 | Valider | Valider options + **Publier** → catalogue alimenté |

Règles métier : [`REGLES-MINO-MAJO.md`](REGLES-MINO-MAJO.md).  
Après 🧪 OK : découper `import-workflow-steps.js` (commencer par étape 2 + shared assign).

---

## Session en direct (checklist)

- [ ] Backend démarré (`node server.js` dans `backend/`)
- [ ] Connecté GDRI + bonne entreprise
- [ ] Onglet Import ouvert
- [ ] Console navigateur sans erreur rouge
- [ ] Action testée = celle de la fonction validée

---

## Notes

- `ugapImportController.js` déjà extrait du monolithe controller — **revue** fonction par fonction, pas réécriture aveugle.
- `admin.php` : retirer le JS import au fur et à mesure ; ne laisser que les `<script src>` et le minimum global (`currentData`, etc.).
