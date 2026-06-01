# Import — règles Minorations / Majorations

> **Statut** : `📝 à valider` avec vous avant tout refactor des options de base.  
> **Source code** : `UgapImportAssignmentService.js` (backend) + `import-workflow-steps.js` (`getImportResolvedLineKind`, `isImportMajorationLabel`).

**Ordre workflow** (depuis réorganisation) :

1. Modèles  
2. **Minorations**  
3. **Majorations**  
4. **Options de base** (après mino + majo enregistrées)  
5. Options / tri  
6. PR  
7. Valider  

---

## Principe

Chaque ligne Excel du staging a un **type effectif** (`getImportResolvedLineKind`) :

| Type | Code | Tableau workflow |
|------|------|------------------|
| Minoration | `minoration` | Étape 2 — Minorations |
| Majoration | `majoration` | Étape 3 — Majorations |
| Option catalogue | `option` | Étape 5 — Options / tri |
| PR (pièce rechange) | `pr` | Étape 6 — PR (hors mino/majo) |

Priorité de décision :

1. **Override manuel** : `importOptionLineKind` = `minoration` | `majoration` | `option` (étape 5 ou correction)  
2. **PR** : libellé commence par `PR ` (espace après PR)  
3. **MINO** : référence UGAP contient `MINO` (insensible à la casse)  
4. **Moins-value** : libellé commence par `moins-value` → minoration  
5. **Majoration** : règles ci-dessous  
6. Sinon → **option catalogue**

Une ligne ne peut pas être minoration **et** majoration.

---

## Minoration (étape 2)

**Règle principale** : la colonne **référence UGAP** contient la chaîne **`MINO`**.

Exemples : `MINO-123`, `UGAP MINO …` → minoration.

**Règle secondaire** : libellé commence par **`moins-value`** (avec ou sans tiret, insensible casse).

**Hors minorations** :

- Toutes les lignes classées **majoration** (voir ci-dessous)  
- PR  
- Options catalogue sans MINO ni moins-value  

**Assignation postes** : croix par modèle (étape 2) ; pas de croix Excel automatique sur les MINO.

---

## Majoration (étape 3)

Une ligne est **majoration** si elle n’est **pas** PR, **pas** MINO, et que le **libellé** (ou la catégorie Excel) correspond à l’un des cas suivants.

### Exclusions (jamais majoration)

| Cas | Motif |
|-----|--------|
| Libellé `PR …` | Pièce rechange → étape PR |
| Réf. contient `MINO` | Minoration |
| Libellé commence par `suppression` / `supress` | Géré via options de base (suppression), pas tableau majorations |
| Forfait / garantie | `forfait`, `garantie`, `extension de garantie` dans le libellé |
| Override `importOptionLineKind` = `minoration` ou `option` | Priorité manuelle |

### Inclusions (majoration)

| Cas | Exemple libellé |
|-----|------------------|
| Commence par `plus-value` ou `plus value` | Plus-value coque… |
| Contient `en remplacement` | … en remplacement de … / ceux de base |
| Contient `en lieu et place` ou `au lieu et place` | … en lieu et place de … |
| Contient `non fourniture` | Non fourniture du moteur de base… |
| **Motorisation catalogue** | Catégorie Excel `Motorisation` **ou** libellé type moteur (voir ci-dessous) |
| Parsing `motor_base_non_supply` | Non fourniture moteur de base (UI) |

### Motorisation catalogue (= majoration)

Sans `en remplacement` dans le libellé, une ligne est majoration si :

- Catégorie = **`Motorisation`**, ou  
- Libellé contient marque / mot-clé : `moteur`, `motorisation`, `Suzuki`, `Mercury`, `Yamaha`, `Honda`, `Evinrude`, `Tohatsu`, `Yanmar`, `Volvo`, ou  
- Motif puissance : `150 CV`, `DF 225`, codes `APX`/`APT`/`BTX`/`ATL` + chiffres, ou  
- `2 moteurs`, `bi-moteur`, `double moteur`, `jumelage moteurs`, etc.

**Exemple** : `Moteur hors-bord essence - Mercury 225…` (ligne tarif moteur complète) → majoration, pas option catalogue simple.

### Ce qui n’est **pas** majoration

- Option catalogue « normale » (équipement, pack, accessoire) **sans** les formulations ci-dessus et **sans** MINO  
- Ligne PR  
- Ligne MINO / moins-value  

---

## Options de base (étape 4 — après majorations)

**À traiter ensuite** : nom, prix, fusion — une fois les étapes 2 et 3 validées.

Règle de nom (déjà codée, à valider) : texte **après** `en remplacement de` / `en lieu et place de` dans le libellé Excel.

**Moteur (tarif catalogue / majo Mercury, Suzuki…)** : l’option de base ne porte **pas** le libellé Excel de la majo (`Moteur hors-bord essence - Mercury F250…`). Le nom vient de la **motorisation du 1er poste coché** (croix Excel), via `motorizationBase` du modèle ou option catalogue du poste (`getMotorLabelForPosteModel`). Les lignes tarif moteur (ex. 4218853, 4218930, 4218935) se rattachent à cette entrée, pas à trois options de base distinctes.

Les motorisations de **base** par modèle (champ modèle) complètent le registre même sans ligne mino/majo.

---

## Tests manuels suggérés

- [ ] Ligne ref `MINO` → uniquement étape Minorations  
- [ ] Ligne `… en remplacement ceux de base` sans MINO → Majorations uniquement  
- [ ] Ligne `PR …` → étape PR, pas mino/majo  
- [ ] Motorisation catégorie Excel → Majorations  
- [ ] Forfait garantie moteur → ni mino ni majo (option ou hors tableau)  
- [ ] Reprise import : étape reprise = Minorations si modèles OK, pas Options de base avant majo  

---

## Alignement backend / frontend

| Règle | Backend `UgapImportAssignmentService` | Frontend `import-workflow-steps.js` |
|-------|----------------------------------------|-------------------------------------|
| MINO | `isMinorationLine` | `ref.includes('MINO')` |
| PR | `isPrLabel` | `isImportPrOption` |
| Majoration libellé | `isMajorationLine` | `isImportMajorationLabel` |
| Moteur catalogue | `isMotorCatalogLine` | `isImportMotorCatalogLine` |
| Moins-value | (via flags import) | `^moins-value` dans `getImportResolvedLineKind` |

En cas d’écart, **corriger les deux** pour garder le même classement.
