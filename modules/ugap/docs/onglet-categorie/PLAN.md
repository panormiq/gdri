# Template bateau (parcours configurateur)

> **UI admin** : l’onglet **Catégorie** est retiré. Paramétrage = **Template bateau** uniquement.  
> Les données `categories[]` / `subCategories[]` restent en base (import, API) ; le template y fait référence via `categoryRefId`.

## Modèle

| Élément | Rôle |
|--------|------|
| **Catalogue** (`ugap_data.categories`) | Données serveur : options, **subCategories[]**, familles — alimenté par import / API |
| **Template bateau** (`uiState.boatTemplates`) | **`snapshot.categoryTree`** : arbre du parcours client + `decisionGroupRefs` |

```
Template (nouveau)
  snapshot.categoryTree[]
    → nœuds (label, children[], decisionGroupRefs[])
    → résolution via catalogue : categoryRefId + familyLabel + groupId
  snapshot.baseOptionIds[]

Template (legacy)
  snapshot.categoryIds[] → migration auto vers categoryTree
```

Le template **compose** le parcours client. Le **catalogue** (données + onglet **Famille**) fournit groupes et lignes options.

### Sous-catégories — un seul endroit (données)

**`categories[].subCategories[]`** uniquement (pas de doublon dans l’arbre template).  
Le configurateur lit les sous-catégories depuis le catalogue quand le nœud template a un `categoryRefId`.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `assets/js/tabs/template-bateau-tab.js` | CRUD templates — éditeur d’arbre `categoryTree` |
| `UgapDataService.normalizeBoatTemplateSnapshot` | `categoryIds` + `baseOptionIds` |

## Migration

Anciens templates (`snapshot.categories[]` ou `snapshot.families[]`) : les IDs sont extraits ou lus en legacy côté `getBoatTemplateSnapshotCategories`.

---

## Configurateur — arbre template bateau (✅ validé)

### Décisions validées

| # | Sujet | Décision |
|---|--------|----------|
| 1 | Sous-catégories | **Arbre dédié au template** uniquement — pas `categories[].subCategories` du catalogue |
| 2 | Une « option » configurateur | **= un groupe de décision** (`decisionGroups[]`) |
| 3 | Choix unique | **Validation au premier clic** dans le modal (pas de bouton Valider) |
| 4 | Choix multiple — suppression | **Les deux** : croix sur chaque puce dans la liste **et** décocher dans le modal puis Valider |

### Structure (arbre template)

L’arbre vit dans `boatTemplates[].snapshot.categoryTree[]`. Le catalogue (`categories[]`, familles, groupes) sert de **référence** pour résoudre labels et lignes options ; il ne définit pas la hiérarchie du parcours.

```
snapshot
  categoryTree[]          ← navigation configurateur (exclusif)
  baseOptionIds[]         ← options de base (inchangé)
  categoryIds[]           ← legacy / migration ; dérivé à plat si categoryTree absent
```

**Nœud** `categoryTree[]` :

| Champ | Type | Rôle |
|-------|------|------|
| `id` | string | ID stable du nœud (ex. `tplcat_…`) |
| `label` | string | Titre affiché dans le configurateur |
| `categoryRefId` | string? | Lien optionnel vers `categories[].id` (pour résoudre familles/groupes catalogue) |
| `children` | nœud[] | Sous-catégories (même schéma, récursif) |
| `decisionGroupRefs` | ref[] | Options = groupes de décision rattachés à ce nœud |

**Référence groupe** `decisionGroupRefs[]` :

| Champ | Type | Rôle |
|-------|------|------|
| `familyLabel` | string | Famille catalogue |
| `groupId` | string | ID du groupe (`decisionGroups[].id`) |
| `sourceIndex` | number? | Index famille catalogue si dispo |

À la résolution : `familyLabel` + `groupId` → groupe complet (label, `decisionMode`, `optionIds` / options compatibles modèle).

Exemple minimal :

```json
{
  "categoryTree": [
    {
      "id": "tplcat_motor",
      "label": "Motorisation",
      "categoryRefId": "cat_motorisation",
      "decisionGroupRefs": [
        { "familyLabel": "Moteur", "groupId": "grp_moteur" }
      ],
      "children": [
        {
          "id": "tplcat_motor_opt",
          "label": "Options moteur",
          "decisionGroupRefs": [
            { "familyLabel": "Moteur", "groupId": "grp_accessoires" }
          ],
          "children": []
        }
      ]
    }
  ],
  "baseOptionIds": []
}
```

### Parcours configurateur

Pour le nœud courant :

1. Afficher les **sous-catégories** (`children`) — cartes / navigation.
2. Afficher les **options** = une ligne par `decisionGroupRef` résolu.

| Mode (`decisionMode`) | Vue principale | Modal |
|----------------------|----------------|-------|
| `single_choice` | Ligne cliquable (libellé groupe + choix actuel ou « — ») | Liste des lignes catalogue ; **1 clic = sélection + fermeture** |
| `multi_choice` | Puces des choix retenus + bouton **+** ; **×** sur chaque puce | Checkboxes (état = sélection actuelle) + bouton **Valider** |

État sélection : réutiliser `state.selectedOptions` (IDs catalogue) ; clé logique groupe = `familyLabel:groupId`.

### Migration

| Ancien snapshot | Comportement |
|-----------------|--------------|
| `categoryIds[]` seul | Générer `categoryTree` : 1 nœud racine par ID, `label` = nom catégorie, `categoryRefId` = id, `decisionGroupRefs` = tous les groupes cochés de la catégorie |
| `categories[]` / `families[]` legacy | Inchangé côté lecture legacy ; nouveaux templates utilisent `categoryTree` |

`normalizeBoatTemplateSnapshot` : conserver `categoryIds` dérivés (aplatissement des feuilles avec `categoryRefId`) pour compat import / compteurs.

### Fichiers cibles (implémentation)

| Fichier | Rôle | Statut |
|---------|------|--------|
| `docs/onglet-categorie/PLAN.md` | Spec (ce document) | ✅ |
| `UgapDataService.normalizeBoatTemplateSnapshot` | `categoryTree` + migration | 💻 |
| `assets/js/tabs/template-bateau-tab.js` | Éditeur arbre (admin template) | 💻 |
| `assets/js/shared/boat-template-tree.js` | Normalisation nœuds + résolution refs → groupes | 💻 |
| `configurateur-template-tree.js` + `index.html` | Rendu parcours + modals | 💻 |
| `getBoatTemplateSnapshotCategories` | Lecture legacy + stats liste | conservé |

### Hors périmètre (pour l’instant)

- Refonte onglet admin **Catégorie** (CRUD familles inchangé).
- `categories[].subCategories` dans le parcours template.
- Vues métier Excel / tableau (comportement actuel conservé).
