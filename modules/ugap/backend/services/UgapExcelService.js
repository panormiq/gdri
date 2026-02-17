/**
 * Service d'extraction des données Excel UGAP
 * Fichier : modules/ugap/backend/services/UgapExcelService.js
 */

const XLSX = require('xlsx');
const path = require('path');

class UgapExcelService {
  /**
   * Lit le fichier Excel et retourne les données brutes
   * @param {string} filePath - Chemin vers le fichier Excel
   * @returns {Array} Tableau de tableaux représentant les lignes du fichier
   */
  static readExcelFile(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
      return raw;
    } catch (error) {
      throw new Error(`Erreur lors de la lecture du fichier Excel: ${error.message}`);
    }
  }

  /**
   * Détecte la structure du fichier Excel
   * Identifie les colonnes de modèles, libellés, prix client et prix UGAP
   * @param {Array} raw - Données brutes du fichier Excel
   * @returns {Object} Structure détectée
   */
  static detectStructure(raw) {
    const structure = {
      headerRowIndex: -1,
      labelCol: -1,
      priceClientCol: -1,
      priceUgapCol: -1,
      modelCols: []
    };

    // Recherche des colonnes de prix
    for (let i = 0; i < Math.min(30, raw.length); i++) {
      const row = raw[i] || [];
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').toLowerCase();
        if (structure.labelCol === -1 && (cell.includes('libell') || cell.includes('désignation'))) {
          structure.labelCol = j;
        }
        if (structure.priceClientCol === -1 && cell.includes('prix') && cell.includes('client')) {
          structure.priceClientCol = j;
        }
        if (structure.priceUgapCol === -1 && cell.includes('prix') && cell.includes('ugap')) {
          structure.priceUgapCol = j;
        }
        if (structure.headerRowIndex === -1 && (structure.labelCol > -1 || structure.priceClientCol > -1)) {
          structure.headerRowIndex = i;
        }
      }
    }

    // Détection des colonnes de modèles via marqueurs X
    const modelCols = this.detectModelColumns(raw, structure.headerRowIndex);
    structure.modelCols = modelCols;

    return structure;
  }

  /**
   * Détecte les colonnes de modèles en cherchant les marqueurs X
   * @param {Array} raw - Données brutes
   * @param {number} startRow - Ligne de départ pour la recherche
   * @returns {Array} Liste des indices de colonnes contenant des modèles
   */
  static detectModelColumns(raw, startRow = 0) {
    const counts = {};
    let maxLen = 0;

    // Compter les X dans chaque colonne
    for (let r = startRow; r < raw.length; r++) {
      const row = raw[r] || [];
      maxLen = Math.max(maxLen, row.length);
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

  /**
   * Extrait le nom d'un modèle depuis une colonne
   * @param {Array} raw - Données brutes
   * @param {number} colIndex - Index de la colonne
   * @param {number} headerRowIndex - Index de la ligne d'en-tête
   * @returns {string} Nom du modèle
   */
  static extractModelName(raw, colIndex, headerRowIndex) {
    // Chercher dans les lignes autour de l'en-tête
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
    return `Modèle ${colIndex}`;
  }

  /**
   * Extrait le prix de base d'un modèle
   * @param {Array} raw - Données brutes
   * @param {number} modelCol - Colonne du modèle
   * @param {number} labelCol - Colonne des libellés
   * @param {number} priceCol - Colonne des prix
   * @param {number} startRow - Ligne de départ
   * @returns {number} Prix de base
   */
  static extractBasePrice(raw, modelCol, labelCol, priceCol, startRow) {
    for (let r = startRow; r < raw.length; r++) {
      const row = raw[r] || [];
      const marker = row[modelCol];
      if (marker !== 'X' && marker !== 'x' && marker !== '×') continue;

      const label = row[labelCol];
      const price = row[priceCol];

      // Chercher une ligne qui ressemble à un prix de base (ex: "Poste semi-rigide")
      if (label && typeof label === 'string') {
        const labelLower = label.toLowerCase();
        if (/poste|base|semi-rigide/i.test(labelLower)) {
          const priceNum = this.parsePrice(price);
          if (priceNum > 0) return priceNum;
        }
      }

      // Sinon, prendre le premier prix trouvé avec un X
      const priceNum = this.parsePrice(price);
      if (priceNum > 0) return priceNum;
    }
    return 0;
  }

  /**
   * Parse un prix depuis une valeur (string ou number)
   * @param {*} value - Valeur à parser
   * @returns {number} Prix en nombre
   */
  static parsePrice(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^\d,.\-]/g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  /**
   * Extrait toutes les données structurées depuis le fichier Excel
   * @param {string} filePath - Chemin vers le fichier Excel
   * @returns {Object} Données structurées { models, options, categories }
   */
  static extractData(filePath) {
    const raw = this.readExcelFile(filePath);
    const structure = this.detectStructure(raw);

    if (structure.headerRowIndex === -1) {
      throw new Error('Impossible de détecter la structure du fichier Excel');
    }

    const startRow = structure.headerRowIndex + 1;

    // 1. Extraire les modèles
    const models = [];
    structure.modelCols.forEach((colIdx) => {
      const name = this.extractModelName(raw, colIdx, structure.headerRowIndex);
      const priceCol = structure.priceClientCol > -1 ? structure.priceClientCol : structure.priceUgapCol;
      const basePrice = this.extractBasePrice(
        raw,
        colIdx,
        structure.labelCol,
        priceCol,
        startRow
      );
      models.push({
        id: `model_${colIdx}`,
        colIndex: colIdx,
        name: name,
        basePrice: basePrice
      });
    });

    // 2. Extraire les options
    const optionsMap = new Map(); // id -> option
    const categoriesMap = new Map(); // categoryName -> { id, name, options: [] }

    for (let r = startRow; r < raw.length; r++) {
      const row = raw[r] || [];
      const label = row[structure.labelCol];

      if (!label || typeof label !== 'string' || label.trim().length === 0) continue;

      const labelStr = String(label).trim();

      // Ignorer les lignes qui sont des modèles (déjà extraits)
      if (/poste|base|semi-rigide/i.test(labelStr.toLowerCase())) continue;

      const priceClient = this.parsePrice(row[structure.priceClientCol] || row[structure.priceUgapCol]);
      const priceUgap = structure.priceUgapCol > -1 ? this.parsePrice(row[structure.priceUgapCol]) : priceClient;

      // Déterminer la catégorie (sera amélioré avec l'IA)
      const category = this.determineCategory(labelStr);

      // Vérifier la compatibilité avec les modèles
      const compatibleModels = [];
      structure.modelCols.forEach((modelCol) => {
        const val = row[modelCol];
        if (val === 'X' || val === 'x' || val === '×') {
          const model = models.find(m => m.colIndex === modelCol);
          if (model) compatibleModels.push(model.id);
        }
      });

      // Si aucune compatibilité spécifique, compatible avec tous
      const finalCompatibleModels = compatibleModels.length > 0 
        ? compatibleModels 
        : models.map(m => m.id);

            const option = {
                id: `opt_${r}`,
                name: labelStr,
                priceClient: priceClient,
                priceUgap: priceUgap,
                category: category,
                compatibleModels: finalCompatibleModels,
                subCategory: null // Sera rempli par l'IA ou manuellement
            };

      optionsMap.set(option.id, option);

      // Ajouter à la catégorie
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, {
          id: `cat_${category.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          name: category,
          options: []
        });
      }
      categoriesMap.get(category).options.push(option);
    }

        const categories = Array.from(categoriesMap.values()).map(cat => ({
            ...cat,
            subCategories: [] // Initialement vide, sera rempli par l'IA ou manuellement
        }));

        return {
            models,
            categories,
            structure
        };
  }

  /**
   * Détermine la catégorie d'une option (heuristique simple, à améliorer avec l'IA)
   * @param {string} label - Libellé de l'option
   * @returns {string} Nom de la catégorie
   */
  static determineCategory(label) {
    if (!label) return 'Autre';
    const l = label.toLowerCase();

    if (l.includes('moteur') || l.includes('suzuki') || l.includes('commande')) return 'Motorisation';
    if (l.includes('flotteur') || l.includes('coloris') || l.includes('tissu')) return 'Flotteurs';
    if (l.includes('console') || l.includes('bolster') || l.includes('siège') || l.includes('assise')) return 'Aménagement';
    if (l.includes('électronique') || l.includes('gps') || l.includes('sondeur') || l.includes('vhf')) return 'Électronique';
    if (l.includes('remorque')) return 'Remorque';
    if (l.includes('armement') || l.includes('sécurité')) return 'Sécurité';
    if (l.includes('transport') || l.includes('livraison')) return 'Services';

    return 'Divers';
  }
}

module.exports = UgapExcelService;
