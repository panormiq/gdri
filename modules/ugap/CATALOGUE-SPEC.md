# UGAP — Spécification Catalogue (v1)

## Objectif

Remplacer la triade **Famille / Catégories / Options** par un **Catalogue unifié** :

- **Colonne gauche** : arborescence catégorie / sous-catégorie (où ranger).
- **Colonne droite** : **objets catalogue** (slots de choix configurateur).
- **Options import** (lignes Excel) : rattachées à **un seul objet** ; tags transversaux pour vues métier.

Le configurateur, Bateau de base et Modèles consommeront `catalogObjectId` (migration phase ultérieure).

---

## Principes

| Règle | Détail |
|-------|--------|
| 1 objet = 1 slot de choix | Pas d’objet multi-attributs (ex. pas « Console » avec model + coloris dedans). |
| Comportement de choix | `decisionMode` : `single_choice` ou `multi_choice` (plus de « type » en UI). |
| 1 option → 1 objet | `catalogObjectId` unique par option. |
| 1 option → N modèles bateau | `compatibleModels[]` (existant). |
| Tags transversaux | Filtre vue « Design », « Garantie », etc. — ne remplace pas l’objet. |

---

## Modèle de données

Stockage : `uiState.catalog` (MongoDB `ugap_data.uiState.catalog`).

```json
{
  "categories": [
    {
      "id": "cat_coque",
      "name": "Coque",
      "subCategories": [
        { "id": "sub_console", "name": "Console" },
        { "id": "sub_sellerie", "name": "Sellerie" }
      ]
    }
  ],
  "objects": [
    {
      "id": "obj_coloris_coque",
      "label": "Coloris coque",
      "type": "choice_set",
      "categoryId": "cat_coque",
      "subCategoryId": "",
      "decisionMode": "single_choice",
      "tags": ["design"],
      "keywords": "coloris, couleur"
    },
    {
      "id": "obj_modele_console",
      "label": "Modèle console",
      "type": "choice_set",
      "categoryId": "cat_coque",
      "subCategoryId": "sub_console",
      "decisionMode": "single_choice",
      "tags": ["design", "equipement"]
    }
  ],
  "tagRegistry": [
    { "id": "design", "label": "Design" },
    { "id": "garantie", "label": "Garantie" },
    { "id": "equipement", "label": "Équipement" },
    { "id": "motorisation", "label": "Motorisation" },
    { "id": "securite", "label": "Sécurité" },
    { "id": "divers", "label": "Divers" }
  ]
}
```

### Option import (`categories[].options[]`)

Champs ajoutés (conservés par `normalizeOption`) :

```json
{
  "id": "opt_…",
  "name": "Rouge Ferrari",
  "catalogObjectId": "obj_coloris_coque",
  "tags": ["design"]
}
```

---

## Types d’objet (`type`)

| Valeur | Rôle |
|--------|------|
| `choice_set` | Choix parmi options liées (radar, coloris, modèle console). |
| `addon` | Option ajoutable seule (`multi_choice` fréquent). |
| `model` | Slot modèle bateau au catalogue. |
| `garantie` | Extension / garantie. |
| `static` | Informatif, sans prix variable. |

### `decisionMode` (objets `choice_set` / `addon`)

- `single_choice` — une seule option (coloris, modèle radar).
- `multi_choice` — liste / pack (plusieurs options cochables).

---

## Exemple métier : Coque

```
Coque (catégorie)
├── Coloris coque          → choice_set, single, tags: [design]
├── Console (sous-cat.)
│   ├── Modèle console     → choice_set, single
│   └── Coloris console    → choice_set, single, tags: [design]
└── Sellerie (sous-cat.)
    └── Coloris sellerie   → choice_set, single, tags: [design]
```

Les lignes Excel « Rouge », « HDS PR 12 » sont des **options**, pas des nœuds d’arbre.

---

## Vues UI (paramétrage)

### Vue structure (défaut)

Deux colonnes : arbre | objets + options de l’objet sélectionné.

### Vue tags

Filtre par tag du registre → liste toutes les options + objet + catégorie.

---

## API

| Méthode | Usage |
|---------|--------|
| `GET /ui-state` | Lire `catalog`. |
| `PUT /ui-state` | `{ "catalog": { … } }` — accepte tableaux vides. |
| `GET /data` | Options catalogue import. |
| `PUT /options/:id` | `{ catalogObjectId, tags }` sur une option. |

---

## Migration (phases)

1. **Phase 1 (actuelle)** — UI Catalogue + `uiState.catalog` ; Famille masqué ; pas de rupture configurateur.
2. **Phase 2** — Script : familles/groupes → `catalog.objects` ; cocher catégories legacy → refs `objectId`.
3. **Phase 3** — Bateau de base / Modèles → `catalogObjectId` au lieu de `familyLabel` + `groupId`.
4. **Phase 4** — Retrait `uiState.families`, onglets Catégories / Options absorbés.

---

## Fichiers frontend (phase 1)

| Fichier | Rôle |
|---------|------|
| `parametrage/assets/js/catalogue/catalogue-lc-state.js` | État + persistance |
| `parametrage/assets/js/catalogue/catalogue-tab.js` | UI 2 colonnes + vue tags |
| `parametrage/assets/css/catalogue.css` | Layout |
| `assets/js/shared/ugap-catalogue-types.js` | Types, tags par défaut |

---

## Références legacy (à ne plus étendre)

- `uiState.families`, `decisionGroups`, `components`
- `categories[].families` (sélection groupes)
- Onglet Famille paramétrage
