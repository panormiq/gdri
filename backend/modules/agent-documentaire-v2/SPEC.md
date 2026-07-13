# Agent Documentaire V2 — Spécification de refonte

> Document de référence consolidé (ne pas oublier).  
> L’agent documentaire **V1** (`backend/modules/agent-documentaire/`) est mis au rebus — personne ne l’utilise en production. On **vampirise** ce qui est utile, on repart sur V2.

**Dernière mise à jour :** 2026-07-07

---

## 1. Vision

Créer un moteur **template → document** basé sur :

- **Collections** (données structurées, imbriquées)
- **Templates** (mise en page graphique A4)
- **Documents** (instances générées = snapshot collections + rendu HTML/PDF)

Premier consommateur : **module UGAP** (devis). Plus tard : dossier technique, Doc Hub (archivage).

```
Collection (données)  +  Template (mise en page)  →  Document (PDF)
```

---

## 2. Ce qu’on garde / jette de la V1

### À vampiriser (V1 + doc-template-v3)

| Élément | Source | Usage V2 |
|---------|--------|----------|
| Namespaces `scope:entité:type` | V1 `ModelService`, templates | `ugap:devis:default`, `ugap:node:moteur` |
| Collections / champs / variants | V1 `ModelService` | Modèle `Collection` V2 |
| Variables `{{namespace.champ}}` | V1 `replaceVariablesInText` | Rendu document |
| PDF Puppeteer | V1 `DocumentService.generatePdfFromHtml` | Export final |
| Page A4 à l’écran | doc-template-v3 `RichTextEditor.css` (`page-wrapper`) | Canvas éditeur |
| WYSIWYG contentEditable | doc-template-v3 `RichTextEditor.js` | Contenu **intra-bloc** (text-frame) |
| Export HTML → PDF | doc-template-v3 `pdfHtmlExporter.js` | Pipeline rendu |

### À jeter (V1)

- Import Word → JSON sections
- Sommaire / TOC obligatoire ou par défaut
- Éditeur 3 colonnes (sommaire | contenu | propriétés) type mémoire technique
- Hiérarchie sections Word (`structure` / `optional` / annexes)
- UI `document-agent/editor.php` actuelle pour le devis

---

## 3. Architecture modules & scopes

```
backend/modules/agent-documentaire-v2/
├── SPEC.md                    ← ce fichier
├── index.js
├── routes.js
├── services/
│   ├── CollectionService.js
│   ├── TemplateService.js
│   ├── DocumentRenderService.js
│   └── PdfService.js
├── scopes/
│   └── ugap/
│       ├── collections/       ← seeds schémas
│       └── templates/
└── ...

frontend/pages/modules/document-agent-v2/
├── index.php
├── editor.php                 ← éditeur canvas A4
└── assets/
    ├── css/canvas-editor.css
    └── js/
        ├── canvas-editor.js
        ├── node-tree.js
        ├── drag-resize.js
        ├── snap-guides.js     ← aimants + lignes construction
        └── text-frame.js
```

### Multi-tenant par scope

| Scope | Exemple namespace | Stockage |
|-------|-------------------|----------|
| UGAP devis | `ugap:devis:{entrepriseId}` | Base entreprise + namespaces |
| UGAP collections | `ugap:ligne-devis`, `ugap:node:moteur` | Idem |
| Futur dossier technique | `ugap:dossier-technique:*` | Phase ultérieure |

**Phase 2 (plus tard)** : couche données externalisée, suite d’apps interconnectées. Prévoir dès maintenant des **IDs stables** (`option.id`, `catalogNodeId`, `namespace`).

---

## 4. Modèle Collections

Une **collection** = schéma + items. Collections **imbriquées** via `parentNamespace`.

```javascript
{
  namespace: "ugap:ligne-devis",
  parentNamespace: "ugap:devis",      // null si racine
  name: "Lignes de devis",
  fields: [
    { key: "refUgap", label: "Réf. UGAP", type: "text" },
    { key: "libelle", label: "Libellé", type: "text" },
    { key: "libelleApp", label: "Libellé app", type: "text" },
    { key: "prix", label: "Prix HT", type: "currency" }
  ],
  items: []                            // rempli au runtime (configurateur UGAP)
}
```

### UGAP : correspondance métier

| Concept UGAP | Collection V2 |
|--------------|---------------|
| Nœud catalogue | `ugap:node:{slug}` (ex. moteur) |
| Option catalogue | `item` dans la collection du nœud |
| Lignes devis | `ugap:ligne-devis` (N items) |
| Devis complet | `ugap:devis` (racine + sous-collections) |
| Client / entreprise | `ugap:client`, `ugap:entreprise` |

**Règle** : UGAP reste la **source de vérité** catalogue ; les collections V2 reçoivent un **snapshot** à la génération (pas de duplication permanente du catalogue).

### Assignation manuelle template ↔ données

Dans le template, placer par ex. `{{ugap:node:moteur.libelle}}`.  
Au rendu, mapping en dur (phase 1) puis configurable :

- Slot `ugap:node:moteur` → option moteur sélectionnée dans le devis
- Slot `ugap:ligne-devis` → toutes les lignes sélectionnées

---

## 5. Modèle Template

```javascript
{
  namespace: "ugap:devis:default",
  documentMode: "canvas",              // toujours canvas pour devis ; pas de mode Word séparé
  page: {
    format: "A4",
    widthMm: 210,
    heightMm: 297,
    margins: { top: 15, right: 15, bottom: 15, left: 15 }
  },
  rootNodes: ["node_page_root"],       // ou arbre plat avec parentId
  nodes: [ /* voir §6 */ ],
  metadata: { scope: "ugap", type: "devis", version: 1 }
}
```

---

## 6. Modèle Nœuds (arbre de mise en page)

**Tout est un nœud** dans un arbre `parentId` + `children`.

### Types de nœuds

| `type` | Rôle |
|--------|------|
| `zone` | Bloc racine métier (une des 6 zones) sur l’A4 |
| `group` | Regroupe des enfants — déplacement ensemble |
| `text-frame` | Cadre positionné ; **texte en flux** à l’intérieur (WYSIWYG) |
| `table` | Tableau lié à une collection (lignes répétées) |
| `image` | Image (champ collection ou URL fixe) |
| `field` | Une seule valeur de collection |
| `shape` | Ligne / rectangle décoratif (optionnel phase 2) |

### Les 8 zones métier (devis)

1. `entreprise`
2. `client`
3. `devis` (métadonnées : numéro, date, validité)
4. `lignes`
5. `total-devis` (sous-total, budget 5 %, total HT)
6. `transport`
7. `bon-pour-accord`
8. `pied-de-page`

### Structure d’un nœud

```javascript
{
  id: "node_xxx",
  type: "zone" | "group" | "text-frame" | "table" | "image" | "field",
  parentId: null | "node_parent",
  zoneType: "entreprise" | "client" | "devis" | "lignes" | "total-devis" | "transport" | "bon-pour-accord" | "pied-de-page" | null,

  layout: {
    x: 10, y: 15, width: 90, height: 40,
    unit: "mm" | "%",           // % = relatif au parent
    position: "absolute"
  },

  locked: false,
  visible: true,
  zIndex: 1,

  // text-frame
  content: {
    mode: "flow",
    html: "<p>{{ugap:entreprise.raisonSociale}}</p>"
  },

  // table
  tableConfig: {
    collectionNamespace: "ugap:ligne-devis",
    visibleFields: ["refUgap", "libelle", "prix"],
    fieldOrder: ["refUgap", "libelle", "prix"]
  },

  // image / field
  bind: {
    collectionNamespace: "ugap:entreprise",
    fieldKey: "logoUrl"
  },

  style: {
    fontFamily, fontSize, fontWeight, color,
    border, backgroundColor, padding
  },

  children: []    // pour zone, group
}
```

### Principe clé : graphique + flux **dans** le bloc

- **Placement** = graphique (drag sur l’A4 ou dans le parent)
- **Texte** = flux **à l’intérieur** d’un `text-frame` (comme une zone de texte InDesign)
- Pas de mode « document Word entier » séparé pour le devis
- Dossier technique plus tard = mêmes blocs, plus de pages, plus de texte flux dans les cadres

### Exemple zone Entreprise

```
[ Zone entreprise — racine sur A4 ]
├── [ Groupe header ]
│   ├── [ image ] logo
│   └── [ text-frame ] coordonnées + SIRET
└── [ text-frame ] conditions / validité
```

### Coordonnées

- **Page** : `mm` absolus (référentiel A4 210×297)
- **Dans zone / groupe** : préférer `%` du parent pour le redimensionnement proportionnel

---

## 7. Éditeur — UX

### Layout écran

```
┌─ Arbre (optionnel) ─┐  ┌─ Canvas A4 ─────────────────┐  ┌─ Propriétés ─┐
│ ▼ Zone entreprise   │  │  marges visibles             │  │ Collection   │
│   ▼ Groupe header   │  │  blocs sélectionnables       │  │ ☑ champs     │
│     • logo          │  │  DRAG / RESIZE ICI           │  │ Style        │
│     • coordonnées   │  │  (pas de drag en propriétés) │  │ Insérer var  │
└─────────────────────┘  └──────────────────────────────┘  └──────────────┘
```

### Règles d’interaction

| Action | Où |
|--------|-----|
| Déplacer / redimensionner un bloc | **Sur le canvas A4** (souris) |
| Grouper / dégrouper | Canvas (sélection multiple) ou arbre |
| Cocher champs visibles | Panneau **Propriétés** uniquement |
| Éditer texte flux | Double-clic dans un `text-frame` |
| Insérer variable `{{…}}` | Propriétés ou palette → curseur dans text-frame |

### Page A4 à l’écran

- Ratio **210 × 297 mm** respecté (zoom optionnel 75 % / 100 % / 125 %)
- Marges du template visibles (zone grisée hors marges)
- **WYSIWYG** : ce qu’on voit ≈ rendu PDF final
- Pas de sommaire par défaut

---

## 8. Guides de construction & aimants (snap)

### Lignes de construction

- **Lignes verticales et horizontales** affichables à la demande (grille / guides)
- Création : glisser depuis la règle (règle top + left) ou raccourci « ajouter guide »
- Guides **par page** (stockés dans le template)
- Couleur discrète (ex. bleu cyan `#00bcd4`), non imprimées dans le PDF

```javascript
guides: {
  vertical: [ 15, 105, 195 ],    // mm depuis bord gauche page
  horizontal: [ 20, 148, 280 ]   // mm depuis haut page
}
```

### Aimants (snap magnétique)

Lors du drag / resize d’un nœud :

| Cible d’accroche | Priorité |
|------------------|----------|
| Bords et centre de la **page** (marges incluses) | Haute |
| **Guides** verticaux / horizontaux | Haute |
| Bords et centre des **autres nœuds** (alignement) | Moyenne |
| Bords du **parent** (zone / groupe) | Moyenne |
| Grille fixe (ex. pas de 5 mm) | Basse (optionnel) |

Comportement :

- Seuil d’accroche configurable (ex. 4 px à l’écran)
- **Lignes d’alignement dynamiques** pendant le drag (smart guides type Figma/Sketch)
- Indicateur visuel quand un snap est actif
- Touche **Alt** = désactiver aimants temporairement
- Snap sur : gauche, centre, droite, haut, milieu, bas

```javascript
snap: {
  enabled: true,
  thresholdPx: 4,
  snapToPage: true,
  snapToGuides: true,
  snapToNodes: true,
  snapToGrid: false,
  gridStepMm: 5
}
```

### Points d’accroche précis

Chaque nœud expose **9 points** : 4 coins + 4 milieux de côté + centre.  
Les aimants peuvent lier coin-à-coin, centre-à-centre, bord-à-bord.

---

## 9. Génération document & PDF

### Flux UGAP (configurateur)

```
1. Commercial clique « Générer le devis » (configurateur étape 4)
2. POST /api/ugap/devis/render
   - pricing (options, totaux)
   - client, commercial, entreprise
   - snapshot → collections V2
3. DocumentRenderService :
   - charge template ugap:devis:*
   - injecte variables + items collections
   - produit HTML (arbre nœuds → HTML absolu + text-frame flux)
4. PdfService (Puppeteer) → téléchargement PDF
5. (Phase 3) archivage Doc Hub
```

### Où se fait la création

| Étape | Où |
|-------|-----|
| Édition modèle | Paramétrage UGAP → éditeur V2 |
| Génération devis | **Configurateur UGAP** (pas l’éditeur) |
| Données | UGAP orchestrateur → collections snapshot |

---

## 10. Collections UGAP — seeds initiaux

| Namespace | parent | Rôle |
|-----------|--------|------|
| `ugap:devis` | — | Racine document devis |
| `ugap:entreprise` | `ugap:devis` | Infos vendeur |
| `ugap:client` | `ugap:devis` | Destinataire |
| `ugap:ligne-devis` | `ugap:devis` | Lignes options |
| `ugap:node:moteur` | `ugap:devis` | Slot moteur (0–1 item) |
| `ugap:devis-meta` | `ugap:devis` | n°, date, totaux |

---

## 11. Template devis — preset initial

Au premier lancement, créer template `ugap:devis:default` avec :

- Page A4 + marges 15 mm
- 6 zones `type: zone` positionnées approximativement (modifiables)
- Chaque zone contient au minimum un `text-frame` vide ou avec placeholders `{{…}}`
- Zone `lignes` contient un `table` lié à `ugap:ligne-devis`
- Guides par défaut optionnels : centre page (105 mm), ligne header ~25 mm

---

## 12. API V2 (prévision)

Préfixe : `/api/agent-documentaire-v2` (ou remplacer V1 quand prêt)

| Méthode | Route | Rôle |
|---------|-------|------|
| GET/POST/PUT | `/collections` | CRUD collections |
| GET/POST/PUT | `/templates` | CRUD templates |
| GET/PUT | `/templates/:ns/nodes` | Arbre nœuds |
| POST | `/documents/render` | HTML + PDF depuis template + données |
| GET | `/templates/:ns/guides` | Guides construction |

UGAP :

| Méthode | Route | Rôle |
|---------|-------|------|
| POST | `/api/ugap/devis/render` | Orchestre pricing + collections + V2 render |
| GET | `/api/ugap/devis/template-editor` | URL éditeur V2 |

---

## 13. Migration depuis l’intégration V1 (à faire)

Le code UGAP branché sur agent-documentaire **V1** (phase 1 récente) doit être **migré** vers V2 :

- [ ] Retirer lien paramétrage → `document-agent/editor.php` (V1)
- [ ] Retirer `UgapDevisRenderService` → V1 `createDocumentFromTemplate`
- [ ] Brancher `UgapDevisRenderService` → V2 `DocumentRenderService`
- [ ] Conserver : `computeDevisPricing`, `buildDevisVariables`, slot bindings
- [ ] Seeds collections : migrer vers V2 `CollectionService`

Fichiers V1 UGAP à adapter :

- `modules/ugap/backend/services/devis/*`
- `modules/ugap/frontend/parametrage/.../modele-devis-tab.js`

---

## 14. Phases d’implémentation

### Phase 1 — POC éditeur (priorité)

- [ ] Module `agent-documentaire-v2` backend (schéma Mongo collections + templates)
- [ ] Page éditeur : canvas A4, zoom
- [ ] Nœuds : `zone`, `group`, `text-frame` (1 zone entreprise POC)
- [ ] Drag + resize sur canvas
- [ ] **Snap** basique (bords page + autres nœuds)
- [ ] **Guides** horizontaux / verticaux (affichage + création)
- [ ] Panneau propriétés : champs ☑, style
- [ ] Sauvegarde template JSON
- [ ] Rendu HTML statique (sans UGAP)

### Phase 2 — Collections + UGAP devis

- [ ] CollectionService + seeds UGAP
- [ ] Table `lignes` dans zone
- [ ] `POST /ugap/devis/render` → PDF
- [ ] Configurateur : bouton générer (déjà amorcé)
- [ ] Paramétrage : lien éditeur V2

### Phase 3 — Finitions éditeur

- [ ] Arbre des nœuds
- [ ] Grouper / dégrouper
- [ ] Palette variables / insertion dans text-frame
- [ ] Grille 5 mm optionnelle
- [ ] Règles glissantes (rulers)
- [ ] Copier / coller blocs
- [ ] Multi-sélection

### Phase 4 — Écosystème

- [ ] Sync nœuds catalogue UGAP → collections `ugap:node:*`
- [ ] Dossier technique (même moteur, template différent)
- [ ] Doc Hub archivage PDF
- [ ] Couche données externalisée (suite d’apps)

---

## 15. Références code existant

| Besoin | Fichier actuel |
|--------|----------------|
| PDF Puppeteer | `backend/modules/agent-documentaire/services/DocumentService.js` |
| Collections V1 | `backend/modules/agent-documentaire/services/ModelService.js` |
| Page A4 CSS | `frontend/pages/modules/doc-template-v3/templateBuilder/components/editor/RichTextEditor.css` |
| WYSIWYG | `doc-template-v3/.../RichTextEditor.js` |
| Export PDF HTML | `doc-template-v3/document/utils/pdfHtmlExporter.js` |
| Pricing UGAP | `modules/ugap/backend/services/devis/computeDevisPricing.js` |
| Mapping variables UGAP | `modules/ugap/backend/services/devis/buildDevisVariables.js` |

---

## 16. Décisions actées (ne pas rouvrir sans raison)

1. **V1 au rebus** — pas d’évolution de l’éditeur Word/sommaire pour le devis
2. **Devis = mode canvas A4** — pas d’UI flux pleine page
3. **Texte = flux dans un cadre** (`text-frame`) positionné graphiquement
4. **Drag sur le document** — pas dans le panneau propriétés
5. **Groupes + sous-éléments** dans les zones — modèle dès V2
6. **Collections imbriquées** — devis = racine, lignes/nœuds = sous-collections
7. **Génération depuis UGAP configurateur** — pas depuis l’éditeur
8. **Guides + aimants** — requis pour l’alignement pro (§8)
9. **Sommaire** — optionnel futur, jamais par défaut sur devis
10. **Assignation manuelle** `{{ugap:node:moteur}}` etc. dans le template

---

## 17. Glossaire

| Terme | Définition |
|-------|------------|
| **Collection** | Schéma de données + items (équivalent ancien « model » V1) |
| **Template** | Mise en page A4 (arbre de nœuds) |
| **Document** | Instance rendue (snapshot données + HTML/PDF) |
| **Zone** | Bloc racine métier (1 des 6 types devis) |
| **text-frame** | Cadre graphique contenant du texte en flux |
| **Groupe** | Conteneur pour déplacer plusieurs nœuds ensemble |
| **Guide** | Ligne verticale/horizontale d’aide à l’alignement (non imprimée) |
| **Snap** | Aimant — accroche automatique au drag |
| **Scope** | Espace de noms (`ugap`, futur `gderpi`, etc.) |
