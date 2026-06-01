# Onglet Famille — plan de réécriture

> **Méthode** : descriptions → **validation** → code → test `admin.php` → onglet **Options**.  
> Statut : `⬜ à décrire` | `📝 à valider` | `✅ validé` | `💻 codé` | `🧪 testé OK`

**URL** : `admin.php` → onglet **Famille** (`#tab-famille`, `#extraction-famille-content`)

**Rendu actuel** : `renderActiveTab('famille')` → `renderExtractionInsights()` → `renderFamilleTabInner()` → délégation `UgapFamilleTab` / `__legacyRenderFamilleTabInner` dans `admin.php`.

---

## Fichiers cibles (après réécriture)

| Fichier | Rôle |
|---------|------|
| `partials/tabs/tab-famille.php` | HTML mount points uniquement |
| `assets/js/tabs/famille-tab.js` | UI cartes, drag-drop, rendu liste (existant — à compléter) |
| `assets/js/tabs/famille-state.js` | Lecture/écriture `validatedFamilies`, `__ugapFamilleReview`, ui-state |
| `assets/js/tabs/famille-traitement.js` | Pipeline « Traitement » (heuristique + IA suggest) |
| `assets/js/tabs/famille-merge.js` | Fusion / split familles, relations |
| `assets/js/shared/ugap-api.js` | `apiCall`, alerts (réutiliser) |
| `admin.php` | Coque : expose globals minimes, `<script src>` |

**Ne pas déplacer** les prompts IA famille (restent liés onglet Prompts / `ugap.php` pour l’instant).

---

## Schéma groupes de décision (`decisionGroups[]`) — 💻 codé

| Champ | Rôle | Valeurs |
|--------|------|---------|
| `type` | Rôle métier du groupe | `model`, `option`, `static`, `garantie`, `personnalise` |
| `decisionMode` | Mono / multi choix | `single_choice`, `multi_choice` |
| `priceMode` | Calcul prix (séparé du type) | `option`, `minoration`, `majoration`, `static`, `none` |
| `pricingMode` | Alias lecture legacy (`addition` → `option`) | conservé à l’écriture = `priceMode` |

**Module** : `assets/js/shared/ugap-family-decision-group.js` — normalisation + colonnes édition ; catalogue types via `setCatalogGroupTypes`.

**Persistance** : `ui-state.familyGroupTypes[]` — `{ id, title, defaultDecisionMode?, defaultPriceMode? }`.

**Gabarits** : uniquement `ui-state.familyDecisionGroupTemplates[]` (plus de Minimal/Standard intégrés).

**Backend** : `UgapDataService.normalizeFamilyDecisionGroup(s)` — même contrat sur snapshot template bateau.

---

## Persistance (source de vérité)

| Donnée | Où | API |
|--------|-----|-----|
| `validatedFamilies` | `ui-state.families` + mémoire locale | `PUT /ui-state` |
| `familleHeuristicRules` | `ui-state` | idem |
| `optionStatuses` | `ui-state` | idem |
| Review brouillon IA | `window.__ugapFamilleReview` (session) | — |
| Assignations option → famille | champs option + bulk | `POST /options/assign-families-bulk` |

Fonctions admin actuelles à extraire en priorité :

- `getFamilleValidatedFamilies` / `setFamilleValidatedFamilies` 📝
- `getFamilleHeuristicRules` / `setFamilleHeuristicRules` 📝
- `getFamilleUiState` 📝
- `sanitizeFamilleHeuristicRulesForServer` 📝
- `saveUgapUiState` / chargement depuis `loadUgapData` 📝

---

## Bloc A — État & chargement

| Fonction | Description | Cible | Statut |
|----------|-------------|-------|--------|
| `getFamilleValidatedFamilies` | Liste familles validées (labels, optionIds, sous-familles) | `famille-state.js` | 💻 |
| `setFamilleValidatedFamilies` | Met à jour mémoire + marque dirty ui-state | idem | 💻 |
| `getFamilleUiState` | Filtres, cartes repliées, hiddenIds | idem | 💻 |
| `getFamilleHeuristicRules` / `setFamilleHeuristicRules` | Règles mots-clés | idem | 💻 |
| `getOptionFamilyStatuses` / `set` / `getOptionFamilyStatus` | Statuts assigné / non assigné | idem | 💻 |
| `getFamilleFoundOrder` / `set` | Ordre découverte | idem | 💻 |
| `getFamilleRelations` / `set` | Relations entre familles | idem | 💻 |
| `getFamilleValidatedFilterState` / `getFamilleRawListFilterState` | Filtres UI session | idem | 💻 |
| `getFamilleMergePick` | Sélection fusion (session) | idem | 💻 |
| `sanitizeFamilleHeuristicRulesForServer` | Normalisation avant API | idem | 💻 |
| `updateFamilleTabWarningBadge` | Badge alertes onglet | `famille-tab.js` | ⬜ |

**Test** : recharger admin → familles affichées = dernière sauvegarde serveur.

---

## Bloc B — Rendu workspace

| Fonction | Description | Cible | Statut |
|----------|-------------|-------|--------|
| `renderExtractionInsights` | Orchestrateur multi-root (famille ne rend que si `mainActiveTab === 'famille'`) | Garder mince dans admin ou `famille-shell.js` | 📝 |
| `__legacyRenderFamilleTabInner` | HTML principal workspace (~1,1k lignes) | Découper → `famille-tab.js` | 📝 |
| `renderFamilleTabInner` | Proxy vers `UgapFamilleTab` | `famille-tab.js` | 💻 partiel |
| `renderFamilyCardsList` | Cartes familles (déjà dans `famille-tab.js`) | idem | 💻 |
| `renderFamilleSimplifiedFamilyBodyHtml` | Corps carte simplifié | `famille-tab.js` | ⬜ |
| `mountFamilleVueLC` | Mount Vue LC barre outils | `famille-tab.js` ou dédié | ⬜ |
| `ensureFamilleCardGlobalInteractions` | Drag options / familles | `famille-tab.js` | 💻 |

**Test** : ouvrir Famille → cartes visibles → replier/déplier → drag option vers famille.

---

## Bloc C — Traitement (regroupement)

| Fonction | Description | Cible | Statut |
|----------|-------------|-------|--------|
| `runFamilleTraitement` | Lance heuristique + éventuellement IA suggest | `famille-traitement.js` | 📝 |
| `__legacyRunFamilleTraitement` | Impl actuelle admin | à migrer | 📝 |
| `buildFamilleGroupsFromHeuristics` | (nom à confirmer dans code) regroupement local | `famille-traitement.js` | ⬜ |
| Appel `POST /familles/suggest-ia` | Envoie options, reçoit propositions | `famille-traitement.js` | ⬜ |

**Test** : bouton Traitement → familles proposées → validation manuelle carte → sauvegarde ui-state.

---

## Bloc D — Validation & assignation options

| Fonction | Description | Cible | Statut |
|----------|-------------|-------|--------|
| `validateFamilyCard` / équivalent | Passe review → `validatedFamilies` | `famille-state.js` | ⬜ |
| `clearValidatedFamilyAssignments` | Reset assignements | `famille-state.js` | 📝 |
| `mergeEditFamilies` | Fusion 2 familles review | `famille-merge.js` | 📝 |
| `getFamilleMergePick` / `applyFamilleMergePickToDom` | UI fusion | `famille-merge.js` | ⬜ |
| `syncReviewStateIntoIaResult` | Sync review ↔ résultat IA | `famille-state.js` | ⬜ |

**Règles métier** (prompts existants admin ~l.1489) — à recopier dans `REGLES-FAMILLE.md` après validation :

- Choix unique couleur/RAL → **une** famille, tous les `optionIds`.
- Une famille par **dimension** de choix (ex. couleur + type = 2 familles).
- Pas de doublon d’id entre familles.

---

## Bloc E — Liaison onglet Options

| Fonction | Description | Statut |
|----------|-------------|--------|
| `getFamilleChoicesForOptionTab` | Liste familles pour selects Options | 📝 — reste appelée depuis Options |
| `getFamilleSubFamilyMapForOptionTab` | Sous-familles par option | 📝 |

L’onglet **Options** consomme ces helpers — les extraire dans `famille-state.js` exportés sur `window` pour compat.

---

## API — handlers à documenter avant modification

| Route | Statut |
|-------|--------|
| `PUT /ui-state` (champs famille) | 📝 |
| `POST /familles/suggest-ia` | 📝 |
| `POST /familles/assign-views-ia` | 📝 |

---

## Ordre de travail (Famille)

1. ~~**Bloc A** (état)~~ → `famille-state.js` + délégués `admin.php` — **🧪 test manuel**  
1b. ~~**Éditeur gabarits**~~ — intégrés **Minimal** + **Standard** ; autres gabarits = personnalisés (créer / renommer / supprimer) — **🧪**  
2. **Bloc B** (rendu) — en cours : `renderFamilleTabInner` → `famille-tab.js` 💻 ; reste `famille-gabarits.js` + `famille-creation-form.js`  
3. Valider **Bloc C** (traitement)  
4. Valider **Bloc D** (fusion / validation)  
5. Créer `REGLES-FAMILLE.md` si règles validées  
6. Passer à `docs/onglet-options/PLAN.md`

---

## Questions à valider avec vous (avant code)

1. **Import** : considérez-vous l’étape 4–7 import assez stable pour figer les tests et basculer le temps sur Famille ?
2. **Famille** : le workflow principal reste-t-il **Traitement → review cartes → validation → sauvegarde** (pas de changement UX) ?
3. **IA suggest** : toujours obligatoire dans le flux ou heuristique seule suffit pour vos jeux de test ?
4. Priorité **fusion manuelle** vs **assignation vues métier IA** dans la première itération ?

Répondez par bloc (A/B/C…) ou « OK plan » pour démarrer l’extraction **Bloc A** uniquement.
