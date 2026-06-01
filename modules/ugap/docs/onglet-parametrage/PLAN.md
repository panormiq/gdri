# Paramétrage UGAP v2 — plan de réécriture

> **Statut** : 2026-05-22 — coupure legacy effectuée. Coque v2 en place ; onglets à réécrire un par un.

## Décision

L’ancien back-office (`admin-legacy.js`, partials + import partiel) est **figé** sous `_old/`.  
**Tout nouveau code** vit sous `frontend/parametrage/`.

| Zone | Chemin | Statut |
|------|--------|--------|
| Legacy (lecture seule dev) | `frontend/_old/admin.php` | Fige |
| Paramétrage v2 | `frontend/parametrage/` | **Actif** |
| Routeur | `frontend/admin.php` | Redirige → v2 ; `?legacy=1` → old |
| GDRI | `ugap-tab-*.php` | **include PHP direct** (`gdri-embed.php`), plus d’iframe |
| Prompts IA | `ugap-tab-prompts-ia.php` | `_old/gdri-embed-prompts.php` (temporaire) |

**URL test v2** : `/modules/ugap/frontend/parametrage/index.php`  
**URL legacy** : `/modules/ugap/frontend/_old/admin.php`

---

## Méthode (identique Import)

1. **Extraire** le comportement utile depuis `_old` / `admin-legacy.js` (grep ciblé, pas tout lire).
2. **Décrire** chaque fonction → statut `📝 à valider` → `✅ validé` → `💻` → `🧪`.
3. **Coder** dans `parametrage/assets/js/<onglet>/` (200–500 lignes max).
4. **Réutiliser** `shared/ugap-api.js` + services backend existants — pas de nouvelles routes sans `routes.js`.
5. **Tester** dans l’admin GDRI (`ugap.php?tab=parametrage`) après chaque bloc.

---

## Sections paramétrage v2 (niveau 1 — coques UI)

| Section | `param_section` | Dossier JS cible | Plan | Statut UI |
|---------|-----------------|------------------|------|-----------|
| Importation | `importation` | `detect/` + futur `import/` | `docs/onglet-import/` | ✅ sous-onglets détection |
| Famille | `famille` | `famille/` | `docs/onglet-famille/PLAN.md` | coque |
| Modèles | `modeles` | `models/` | — | coque |
| Options | `options` | `options/` | à créer | coque |
| Catégories | `categorie` | `categorie/` | `docs/onglet-categorie/PLAN.md` | coque |
| Bateau de base | `bateau-base` | `template-bateau/` | — | coque |

**Plus tard (non créé)** : Vues métier (`views/`). **Hors paramétrage** : Prompts IA (onglet GDRI).

**Hors paramétrage v2** : Prompts IA (onglet GDRI) reste sur legacy jusqu’à plan dédié phase 5.

---

## Fichiers v2 (coque actuelle)

| Fichier | Rôle |
|---------|------|
| `parametrage/index.php` | Entrée HTML + scripts |
| `parametrage/partials/shell.php` | Nav + panneaux placeholder |
| `parametrage/assets/js/parametrage-boot.js` | Tabs + stats `/data` |
| `parametrage/assets/css/parametrage.css` | Styles coque |

---

## Backend (inchangé pour l’instant)

- Routes : `backend/routes.js` — pas de changement d’URL.
- Services : `UgapDataService`, `UgapExcelService`, `UgapImportAssignmentService`, etc.
- Controller : découpage progressif (`ugapImportController.js` déjà amorcé).

---

## Prochaine étape concrète

**Règles métier** : [`docs/metier/EXCEL-MODELES-OPTIONS.md`](../metier/EXCEL-MODELES-OPTIONS.md) — à valider avec vous.

**UI** (`parametrage/partials/shell.php`) :

1. **Section Paramétrage → Importation** (`param_section=importation`)
2. **Sous-onglets import** (`param_tab=…`) :

| Sous-onglet | Rôle |
|-------------|------|
| Détection | `GET /import/detect-excel` |
| Modèles | Table modèles détectés |
| Minorations / Majorations / Options catalogue / Options de base / PR | Relecture par type |
| Valider | Staging + publication (à coder) |

URL GDRI : `ugap.php?tab=parametrage&param_section=importation&param_tab=detect`

**Ne pas** : onglet GDRI « Import » séparé ni `tab-import.php` legacy.
