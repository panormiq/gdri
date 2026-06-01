# UGAP — Excel : modèles, options et règles métier

> **Statut** : `📝 à valider` — référence pour le paramétrage v2 et l’import.  
> **Code** : `backend/services/excel-detect/`, affichage `parametrage/` onglets détection.  
> **Complément** : [`../onglet-import/REGLES-MINO-MAJO.md`](../onglet-import/REGLES-MINO-MAJO.md) (workflow import détaillé).

---

## 1. Glossaire (termes métier)

| Terme | Définition |
|-------|------------|
| **Tableur / fichier Excel** | Grille tarif UGAP (ex. `TARIF ALU UGAP 2024(6).xlsx`). |
| **Colonne modèle** | Colonne dont l’en-tête identifie un bateau / poste ; contient des **croix** `X` sur les lignes applicables. |
| **Croix (`X`)** | Marqueur cellule : `X`, `x` ou `×`. Indique que la ligne s’applique à ce modèle. |
| **Ligne récap modèle** | **Première** ligne du fichier (après en-têtes) où la colonne modèle a une croix : définit le **nom**, la **motorisation de base**, le **poste**, le **mode livraison** et les **prix** du modèle. |
| **Zone options** | Lignes **après** les récaps : dès qu’on trouve des croix sur des lignes « options », le tarif liste les variantes. |
| **Libellé** | Colonne désignation / libellé produit. |
| **Réf. UGAP** | Colonne référence UGAP (détection **MINO** pour minorations). |
| **Prix client** | Premier tarif commercial (colonne « prix client »). |
| **Prix UGAP** | Second tarif (colonne « prix UGAP ») — **les deux sont enregistrés**. |
| **Type de ligne** | Code : `minoration`, `majoration`, `catalogue`, `base_option`, `pr` — **pas** une colonne Excel. |

> **Ne pas confondre** : la « catégorie catalogue » (Motorisation, Flotteurs…) est une **heuristique legacy** sur le libellé, utilisée en interne pour certaines majorations moteur. **Elle n’est pas dans le fichier Excel** et **n’est pas affichée** dans les onglets détection v2.
| **Minoration** | Ligne dont la réf. UGAP contient `MINO` (ou libellé « moins-value »). |
| **Majoration** | Ligne « en remplacement », « en lieu et place », plus-value, non-fourniture, motorisation catalogue, etc. |
| **Option de base** | Équipement / motorisation **incluse** dans le poste ; déduite des majorations/minorations ou du récap modèle. |
| **PR** | Pièce rechange : libellé commence par `PR ` (espace après PR). |

---

## 2. Structure du tableur (colonnes détectées)

| Rôle | Détection automatique |
|------|------------------------|
| Ligne d’en-tête | Première ligne contenant « libellé » / « désignation » et/ou « prix ». |
| Colonne libellé | Cellule en-tête contient `libell` ou `désignation`. |
| Colonne prix client | `prix` + `client`. |
| Colonne prix UGAP | `prix` + `ugap`. |
| Colonne réf. UGAP | `réf` / `ref` + `ugap`. |
| Colonne réf. fournisseur | `fournisseur` / `f/seur` (hors UGAP). |
| Colonnes modèles | Colonnes avec **≥ 2 croix** dans le corps du tableau (après en-tête). |

### Modèles (titres de colonnes)

- Les **noms de modèles** sont portés par les **titres de colonnes** (lignes proches de l’en-tête, ex. `P698 ALU`, `Zeppelin 450`).
- Chaque colonne modèle a sa **propre** colonne de croix.

### Ligne récap (première croix par modèle)

Pour chaque colonne modèle, la **première ligne** contenant `X` dans cette colonne est le **récap** :

| Champ extrait | Source (libellé récap) |
|---------------|-------------------------|
| Nom embarcation | Texte avant le premier ` - ` (tiret entouré d’espaces), ou avant marque moteur connue. |
| Motorisation de base | Après le premier ` - `, ou à partir de `Suzuki`, `Mercury`, etc. |
| Poste | Motif `Poste N` (ex. `Poste 1`). |
| Prix client / UGAP | Cellules prix sur **cette même ligne**. |

> **UI détection** : colonne « départ usine » non affichée (info optionnelle dans le libellé seulement).

**Exemple** (tirets ` - ` présents mais **pas obligatoires** partout) :

```text
Embarcation semi-rigide coque aluminium Zeppelin 698 XV ALU - Suzuki DF200 APX 200 ch Poste 1 - départ usine
```

Sans ` - ` : découpage par marque moteur (`Suzuki`, `Mercury`, …) dans le libellé.

---

## 3. Types de lignes (options)

| Type | Code | Règle principale | Croix modèles |
|------|------|------------------|---------------|
| Récap modèle | `model_recap` | Première croix de la colonne modèle | 1 ligne / modèle |
| **Minoration** | `minoration` | Réf. UGAP contient **`MINO`** (insensible casse) ; ou libellé commence par `moins-value` | Oui (sauf PR) ; cas moteur spécial §4 |
| **Majoration** | `majoration` | Voir §3.1 — **pas** PR, **pas** MINO | Oui |
| **Option catalogue** | `catalogue` | Ligne tarif avec croix, hors types ci-dessus | Oui |
| **Option de base** | `base_option` | Déduite (§4) — pas une ligne Excel isolée « type base » | Liée au modèle / poste |
| **PR** | `pr` | Libellé commence par **`PR `** | **Non** (pas d’assignation croix auto) |

Priorité de classification (une seule catégorie) :

1. `pr`  
2. `minoration`  
3. `majoration`  
4. `base_option` (candidat dérivé — voir §4)  
5. `catalogue`

### 3.1 Majoration (libellé)

Une ligne est **majoration** si elle n’est ni PR ni MINO et que le libellé vérifie :

| Motif | Exemples |
|-------|----------|
| `plus-value` / `plus value` | Plus-value coque… |
| `en remplacement` | … en remplacement de … / ceux de base |
| `en lieu et place` / `au lieu et place` | … en lieu et place de … |
| `non fourniture` | Non fourniture du moteur de base… |
| Moteur catalogue | Libellé contient **`hors-bord`** (plus de détection « moteur » / « motorisation » / marques seules) |

**Remplacement** : texte **avant** le mot-clé = nouvel objet ; texte **après** = objet remplacé.

**Exclusions** : `suppression`, forfait, garantie, extension de garantie.

### 3.2 Minoration

| Règle | Détail |
|-------|--------|
| Réf. UGAP | Contient la chaîne **`MINO`**. |
| Libellé | Peut commencer par **`moins-value`**. |

---

## 4. Options de base (déduction métier)

Les **options de base** ne sont en général **pas** une ligne « type BASE » dans Excel. Elles se **déduisent** :

### 4.1 Depuis majorations / minorations

- Texte après `en remplacement de` / `en lieu et place de` → nom de l’équipement de base remplacé.
- Majorations moteur : le nom de base vient souvent de la **motorisation du 1er poste** (récap modèle), pas du libellé Mercury/Suzuki de la ligne majo.

### 4.2 Cas moteur via minoration (règle utilisateur)

Pour les **moteurs** :

1. Une **minoration** a une **croix** sur le modèle concerné.  
2. Le **libellé de la première option** (première ligne option avec croix **après** le récap, ou libellé récap) donne le **nom** de l’option de base.  
3. Le **prix** de l’option de base = **prix de la minoration** (client + UGAP enregistrés).  
4. Les tirets ` - ` autour du nom ne sont **pas** toujours présents → parser souple (voir `parseBaseModelLabel`).

### 4.3 Registre

- Chaque modèle porte aussi `motorizationBase`, `posteNumber`, `defaultDeliveryMode` issus du **récap**.

---

## 5. Tables / objets logiciels (aperçu détection)

Objet renvoyé par `GET /api/ugap/import/detect-excel` :

```json
{
  "structure": { "headerRowIndex", "labelCol", "priceClientCol", "priceUgapCol", "refUgapCol", "modelCols": [] },
  "models": [
    {
      "id", "colIndex", "name", "baseLabel", "motorizationBase", "posteNumber",
      "priceClient", "priceUgap", "rowIndex"
    }
  ],
  "linesByKind": {
    "minoration": [ { "rowIndex", "label", "refUgap", "priceClient", "priceUgap", "compatibleModelIds": [] } ],
    "majoration": [],
    "catalogue": [],
    "base_option": [],
    "pr": []
  },
  "counts": { "minoration": 0, "majoration": 0, "catalogue": 0, "base_option": 0, "pr": 0 }
}
```

Persistance catalogue (Mongo, hors détection) : collections existantes `ugap_data` / `ugap_import_staging` — inchangées à ce stade.

---

## 6. Onglets paramétrage v2 (affichage)

| Onglet | Contenu |
|--------|---------|
| **Détection** | Charger / lancer analyse Excel |
| **Modèles** | Table récaps : nom, poste, motorisation, prix client & UGAP, colonne |
| **Minorations** | Lignes classées `minoration` |
| **Majorations** | Lignes classées `majoration` |
| **Options catalogue** | Lignes `catalogue` + croix par modèle |
| **Options de base** | Candidats `base_option` + lien récap / mino moteur |
| **PR** | Lignes `pr` |

---

## 7. Fichiers code (1 fonction = 1 fichier)

| Fichier | Rôle |
|---------|------|
| `excel-detect/isCrossMarker.js` | Croix `X` / `x` / `×` |
| `excel-detect/detectModelColumns.js` | Colonnes modèles (seuil ≥ 2 X) |
| `excel-detect/detectExcelColumns.js` | Colonnes libellé, prix, réf. |
| `excel-detect/parseBaseModelLabel.js` | Parse libellé récap modèle |
| `excel-detect/resolveImportLineKind.js` | Type ligne : pr / minoration / majoration / catalogue / base_option |
| `excel-detect/extractModelRecapRow.js` | Première croix = récap par colonne |
| `excel-detect/buildExcelDetectionReport.js` | Rapport complet pour l’API |
| `excel-detect/index.js` | Réexport |

Frontend : `parametrage/assets/js/detect/*.js` (1 rôle par fichier, voir en-têtes).

---

## 8. Validation utilisateur

- [ ] Colonnes modèles détectées = titres attendus du fichier réel  
- [ ] Première croix = bon récap (nom + motorisation + poste + 2 prix)  
- [ ] MINO → onglet Minorations uniquement  
- [ ] `PR ` → onglet PR, sans croix auto  
- [ ] Majorations : `en remplacement` / moteur catalogue  
- [ ] Options de base moteur : mino + croix + nom 1ère option  
