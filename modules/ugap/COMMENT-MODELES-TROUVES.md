# Comment les modèles sont détectés dans le fichier Excel

## Processus de détection

### 1. Détection de la structure du fichier

Le service `UgapExcelService` analyse le fichier Excel pour identifier :
- La ligne d'en-tête (headerRowIndex)
- La colonne des libellés (labelCol)
- Les colonnes des prix (priceClientCol, priceUgapCol)
- **Les colonnes des modèles (modelCols)**

### 2. Détection des colonnes de modèles

La méthode `detectModelColumns()` identifie les colonnes contenant des modèles en cherchant les **marqueurs "X"** :

```javascript
static detectModelColumns(raw, startRow = 0) {
  const counts = {};
  
  // Compter les X dans chaque colonne
  for (let r = startRow; r < raw.length; r++) {
    const row = raw[r] || [];
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (v === 'X' || v === 'x' || v === '×') {
        counts[c] = (counts[c] || 0) + 1;
      }
    }
  }
  
  // Filtrer les colonnes avec au moins 2 occurrences de X
  const threshold = 2;
  const cols = [];
  for (let c = 0; c < maxLen; c++) {
    if ((counts[c] || 0) >= threshold) {
      cols.push(c);
    }
  }
  
  return cols;
}
```

**Logique** :
1. Parcourt toutes les lignes du fichier Excel
2. Compte le nombre de "X" (ou "x" ou "×") dans chaque colonne
3. Considère qu'une colonne contient un modèle si elle a **au moins 2 occurrences de X**
4. Retourne la liste des indices de colonnes

### 3. Extraction du nom du modèle

Pour chaque colonne détectée, la méthode `extractModelName()` cherche le nom du modèle :

```javascript
static extractModelName(raw, colIndex, headerRowIndex) {
  // Chercher dans les lignes autour de l'en-tête (3 lignes avant/après)
  for (let i = Math.max(0, headerRowIndex - 3); i <= headerRowIndex + 3 && i < raw.length; i++) {
    const cell = raw[i] && raw[i][colIndex];
    if (cell && typeof cell === 'string' && cell.trim().length > 0) {
      const name = String(cell).trim();
      // Filtrer les noms qui ressemblent à des modèles
      if (/p\d+|alu|620|750|rescue|patrol/i.test(name)) {
        return name;
      }
    }
  }
  return `Modèle ${colIndex}`; // Fallback
}
```

**Logique** :
1. Cherche dans les lignes autour de l'en-tête (3 lignes avant/après)
2. Vérifie si le contenu ressemble à un nom de modèle (regex : `p\d+|alu|620|750|rescue|patrol`)
3. Si trouvé, retourne le nom
4. Sinon, utilise un nom par défaut : `Modèle {colIndex}`

### 4. Extraction du prix de base

La méthode `extractBasePrice()` cherche le prix de base d'un modèle :

```javascript
static extractBasePrice(raw, modelCol, labelCol, priceCol, startRow) {
  for (let r = startRow; r < raw.length; r++) {
    const row = raw[r] || [];
    const marker = row[modelCol];
    
    // Chercher les lignes avec un X dans la colonne du modèle
    if (marker !== 'X' && marker !== 'x' && marker !== '×') continue;
    
    const label = row[labelCol];
    const price = row[priceCol];
    
    // Priorité 1: Chercher "Poste semi-rigide" ou similaire
    if (label && typeof label === 'string') {
      const labelLower = label.toLowerCase();
      if (/poste|base|semi-rigide/i.test(labelLower)) {
        const priceNum = this.parsePrice(price);
        if (priceNum > 0) return priceNum;
      }
    }
    
    // Priorité 2: Prendre le premier prix trouvé avec un X
    const priceNum = this.parsePrice(price);
    if (priceNum > 0) return priceNum;
  }
  return 0;
}
```

**Logique** :
1. Parcourt les lignes à partir de la ligne d'en-tête
2. Cherche les lignes avec un "X" dans la colonne du modèle
3. **Priorité 1** : Si le libellé contient "poste", "base" ou "semi-rigide", prend ce prix
4. **Priorité 2** : Sinon, prend le premier prix trouvé avec un X
5. Retourne 0 si aucun prix n'est trouvé

## Exemple concret

Supposons un fichier Excel avec cette structure :

```
|     |  F  |  G  |  H  |  I  | ... |  O  |  P  |  Q  |
|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| 13  | P5  | P6  | P7  | P8  | ... | Lib | Prix| Prix|
|     |     |     |     |     |     |     | Cli | UGAP|
| 14  |     |     |     |     | ... |     |     |     |
| 15  |  X  |  X  |  X  |  X  | ... | Poste| 5000| 4500|
| 16  |  X  |     |  X  |     | ... | Option1| 100| 90 |
| 17  |     |  X  |     |  X  | ... | Option2| 200| 180|
```

**Détection** :
1. `detectModelColumns()` trouve les colonnes F, G, H, I (chacune a au moins 2 X)
2. `extractModelName()` trouve "P5", "P6", "P7", "P8" dans la ligne 13
3. `extractBasePrice()` trouve 5000 pour chaque modèle (ligne 15, libellé "Poste")

**Résultat** :
```json
{
  "models": [
    { "id": "model_5", "name": "P5", "basePrice": 5000 },
    { "id": "model_6", "name": "P6", "basePrice": 5000 },
    { "id": "model_7", "name": "P7", "basePrice": 5000 },
    { "id": "model_8", "name": "P8", "basePrice": 5000 }
  ]
}
```

## Améliorations possibles

1. **Détection plus intelligente** : Utiliser l'IA pour mieux identifier les modèles
2. **Configuration manuelle** : Permettre de spécifier manuellement les colonnes de modèles
3. **Détection des noms** : Améliorer la regex pour détecter plus de types de noms
4. **Prix de base** : Améliorer la détection du prix de base (peut être dans une ligne spécifique)

## Debug

Pour voir comment les modèles sont détectés, vous pouvez ajouter des logs dans `UgapExcelService.js` :

```javascript
console.log('Colonnes détectées:', structure.modelCols);
console.log('Noms extraits:', models.map(m => ({ col: m.colIndex, name: m.name })));
```
