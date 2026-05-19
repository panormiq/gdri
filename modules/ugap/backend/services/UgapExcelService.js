/**
 * Service d'extraction des données Excel UGAP
 * Fichier : modules/ugap/backend/services/UgapExcelService.js
 */

const XLSX = require('xlsx');
const path = require('path');
const UgapImportAssignmentService = require('./UgapImportAssignmentService');

class UgapExcelService {
  static isCrossMarker(value) {
    const raw = String(value ?? '').trim();
    return raw === 'X' || raw === 'x' || raw === '×';
  }

  static parseBaseModelLabel(label) {
    const raw = String(label || '').replace(/\s+/g, ' ').trim();
    if (!raw) {
      return {
        modelName: '',
        motorizationBase: '',
        posteNumber: null,
        deliveryMode: ''
      };
    }

    const posteMatch = raw.match(/\bposte\s*(\d+)\b/i);
    const posteNumber = posteMatch ? parseInt(posteMatch[1], 10) : null;

    const beforePoste = (posteMatch && posteMatch.index >= 0)
      ? raw.slice(0, posteMatch.index).trim().replace(/[-–—]\s*$/, '').trim()
      : raw;

    let modelName = beforePoste;
    let motorizationBase = '';

    const firstDashIndex = beforePoste.indexOf(' - ');
    if (firstDashIndex > -1) {
      modelName = beforePoste.slice(0, firstDashIndex).trim();
      motorizationBase = beforePoste.slice(firstDashIndex + 3).trim();
    } else {
      // Fallback sans séparateur " - " : découpe sur marque moteur/indice de motorisation.
      const motorizationMarker = beforePoste.match(/\b(suzuki|mercury|yamaha|honda|evinrude|double)\b/i);
      if (motorizationMarker && motorizationMarker.index > 0) {
        modelName = beforePoste.slice(0, motorizationMarker.index).trim().replace(/[-–—]\s*$/, '').trim();
        motorizationBase = beforePoste.slice(motorizationMarker.index).trim();
      }
    }

    const deliveryMode = /\bd[ée]part\s+usine\b/i.test(raw) ? 'Départ usine' : '';

    return {
      modelName,
      motorizationBase,
      posteNumber: Number.isFinite(posteNumber) ? posteNumber : null,
      deliveryMode
    };
  }

  static extractBaseModelData(raw, modelCol, labelCol, priceCol, startRow) {
    for (let r = startRow; r < raw.length; r++) {
      const row = raw[r] || [];
      const marker = row[modelCol];
      if (!this.isCrossMarker(marker)) continue;

      const label = row[labelCol];
      const labelStr = typeof label === 'string' ? label.trim() : '';
      if (!labelStr) continue;

      const priceNum = this.parsePrice(row[priceCol]);
      const parsed = this.parseBaseModelLabel(labelStr);

      return {
        rowIndex: r,
        label: labelStr,
        basePrice: priceNum > 0 ? priceNum : 0,
        modelName: parsed.modelName,
        motorizationBase: parsed.motorizationBase,
        posteNumber: parsed.posteNumber,
        deliveryMode: parsed.deliveryMode
      };
    }

    return {
      rowIndex: -1,
      label: '',
      basePrice: 0,
      modelName: '',
      motorizationBase: '',
      posteNumber: null,
      deliveryMode: ''
    };
  }

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
      refUgapCol: -1,
      refFournisseurCol: -1,
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
        if (
          structure.refUgapCol === -1 &&
          (
            (cell.includes('ref') || cell.includes('réf') || cell.includes('reference')) &&
            cell.includes('ugap')
          )
        ) {
          structure.refUgapCol = j;
        }
        if (
          structure.refFournisseurCol === -1 &&
          (cell.includes('f/seur') || cell.includes('f /seur') || cell.includes('fournisseur')) &&
          (cell.includes('ref') || cell.includes('réf') || cell.includes('reference')) &&
          !cell.includes('ugap')
        ) {
          structure.refFournisseurCol = j;
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
        if (this.isCrossMarker(v)) {
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
      if (!this.isCrossMarker(marker)) continue;

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
   * Réduit le segment avant « en remplacement de » aux mots « slot » (combiné, module sondeur…),
   * sans les codes produits (NSX 3009 XDCR, NSX12XDCR, etc.) pour regrouper les variantes.
   */
  static _optionFamilySkeletonBeforeRempl(beforeRempl) {
    const raw = String(beforeRempl || '').trim();
    if (!raw) return '';
    const tokens = raw.split(/\s+/);
    const kept = [];
    for (const t of tokens) {
      if (/^\d+$/.test(t)) continue;
      if (/^[A-Za-z]*\d+[A-Za-z0-9.-]*$/i.test(t) && /\d/.test(t)) continue;
      if (/^[A-Z0-9]{4,}$/.test(t) && !/[aeiouyàâéèêëïîôùû]/i.test(t)) continue;
      if (/^[A-Z]{2,4}$/.test(t) && t === t.toUpperCase() && !/[aeiouy]/i.test(t)) continue;
      kept.push(t);
    }
    return kept.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /**
   * Clé de famille pour moins-value / plus-value : même « créneau » (équipement fourni de base +
   * postes + type d'ajustement sans le produit de remplacement), ex. deux NSX différents pour le même HDS PRO 12.
   * Chaîne vide si le libellé ne correspond pas au motif attendu.
   * @param {string} label
   * @returns {string}
   */
  static computeOptionFamilyKey(label) {
    const raw = String(label || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    if (/^PR\s/i.test(raw)) return '';

    const hasMvPvPrefix = /^(moins-value|plus-value|plus\s+value)\b/i.test(raw);
    const remplIdx = raw.search(/\ben\s+remplacement\s+de\b/i);
    const remplIdxLoose = raw.search(/\ben\s+remplacement\b/i);
    if (!hasMvPvPrefix && remplIdx < 0 && remplIdxLoose < 0) return '';

    let rest = raw.replace(/^(moins-value|plus-value|plus\s+value)\s+/i, '').trim();

    const parsed = this.parseBaseReplacementProducts(rest);
    const baseReplaced = String(parsed.initialProduct || '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!baseReplaced) return '';

    const postesKey = this.extractPostesKey(rest);
    const idxRempl = rest.search(/\ben\s+remplacement(?:\s+de)?\b/i);
    const beforeRempl = idxRempl > 0 ? rest.slice(0, idxRempl).trim() : rest;
    const skeleton = this._optionFamilySkeletonBeforeRempl(beforeRempl) || '_';

    return `${baseReplaced}|${postesKey}|${skeleton}`;
  }

  /**
   * Extrait le produit initial / final depuis un libellé lié à la base.
   * Heuristique: robuste et déterministe (sans IA), pour exploitation immédiate.
   * @param {string} label
   * @returns {{ changeType: string, initialProduct: string, finalProduct: string }}
   */
  /**
   * « Suppression roll bar - … » ou « Suppression VHF … prévue de base » : équipement retiré, rien en remplacement.
   * @param {string} cleaned
   */
  static tryParseSuppressionProducts(cleaned) {
    const text = String(cleaned || '').replace(/\s+/g, ' ').trim();
    if (!/^supp?ress(?:ion)?\b/i.test(text)) return null;

    const prevueMatch = text.match(/^supp?ress(?:ion)?\s+(.+?)\s+pr[eéè]v[uue]{1,2}\s+de\s+base\b/i);
    if (prevueMatch) {
      return {
        changeType: 'suppression',
        initialProduct: String(prevueMatch[1] || '').trim(),
        finalProduct: 'Suppression'
      };
    }

    const genericMatch = text.match(/^supp?ress(?:ion)?\s+(.+)$/i);
    if (genericMatch) {
      let initialProduct = String(genericMatch[1] || '').trim();
      initialProduct = initialProduct.replace(/\s+pr[eéè]v[uue]{1,2}\s+de\s+base\s*$/i, '').trim();
      initialProduct = initialProduct.replace(/\s*-\s*sous\s+r[eé]serve\b.*$/i, '').trim();
      return {
        changeType: 'suppression',
        initialProduct,
        finalProduct: 'Suppression'
      };
    }

    return null;
  }

  static parseBaseReplacementProducts(label) {
    const raw = String(label || '').replace(/\s+/g, ' ').trim();
    if (!raw) {
      return { changeType: '', initialProduct: '', finalProduct: '' };
    }

    const cleaned = raw.replace(/\s*-\s*postes?\s+[\d\s,etàa\-–—]+$/i, '').trim();

    const suppression = this.tryParseSuppressionProducts(cleaned);
    if (suppression) return suppression;

    // Cas spécial demandé : "Non fourniture du moteur de base"
    if (/\bnon\s+fourniture\s+du\s+moteur\s+de\s+base\b/i.test(cleaned)) {
      return {
        changeType: 'motor_base_non_supply',
        initialProduct: 'moteur de base',
        finalProduct: 'moteur choisi'
      };
    }

    // Cas générique: "Non fourniture du/de la/des ..."
    // Ex: "Non fourniture du caillebotis dans le fond des coffres"
    const nonSupplyMatch = cleaned.match(/^non\s+fourniture\s+(?:du|de\s+la|des|de\s+l['’])\s+(.+)$/i);
    if (nonSupplyMatch) {
      const initialProduct = String(nonSupplyMatch[1] || '')
        .replace(/\s*-\s*postes?\s+[\d\s,etàa\-–—]+$/i, '')
        .trim();
      return {
        changeType: 'non_supply',
        initialProduct,
        finalProduct: ''
      };
    }

    const replacementMatch =
      cleaned.match(/^(.*?)\s+en\s+remplacement\s+de\s+(?:l['’]|la\s+|le\s+|les\s+)?(.+?)\s+fourni\s+de\s+base\b/i) ||
      cleaned.match(/^(.*?)\s+en\s+remplacement\s+de\s+(?:l['’]|la\s+|le\s+|les\s+)?(.+)$/i) ||
      cleaned.match(/^(.*?)\s+en\s+remplacement\s+(?:de\s+)?(?:l['’]|la\s+|le\s+|les\s+)?(.+)$/i);
    if (replacementMatch) {
      const before = String(replacementMatch[1] || '').trim();
      const replacedBase = String(replacementMatch[2] || '')
        .replace(/\s*-\s*postes?\s+[\d\s,etàa\-–—]+$/i, '')
        .trim();
      const beforeNoPrefix = before.replace(/^(moins-value|plus-value|plus\s+value)\s+/i, '').trim();

      // Produit final: on retire les mots "slot" usuels pour tenter de garder le code/nom produit.
      let finalProduct = beforeNoPrefix
        .replace(/^(module\s+sondeur|combin[ée]|motorisation|moteur|pack|option)\s+/i, '')
        .trim();
      if (!finalProduct) finalProduct = beforeNoPrefix;

      // "en remplacement de celui de base" -> inférence simple depuis le début.
      let initialProduct = replacedBase;
      if (/^celui\s+de\s+base$/i.test(initialProduct)) {
        const head = beforeNoPrefix.match(/\b(flotteur|moteur|combin[ée]|sondeur|module|coque|console)\b/i);
        initialProduct = head ? `${head[1].toLowerCase()} de base` : 'produit de base';
      }

      return {
        changeType: 'replacement',
        initialProduct,
        finalProduct
      };
    }

    // Cas "en lieu et place"
    const inPlaceMatch = cleaned.match(/^(.*?)\s+(?:au|en)\s+lieu\s+et\s+place\s+de\s+(?:l['’]|la\s+|le\s+|les\s+)?(.+)$/i);
    if (inPlaceMatch) {
      const finalProduct = String(inPlaceMatch[1] || '').trim();
      const initialProduct = String(inPlaceMatch[2] || '').trim();
      return {
        changeType: 'replacement',
        initialProduct,
        finalProduct
      };
    }

    return { changeType: '', initialProduct: '', finalProduct: '' };
  }

  /**
   * Extrait une clé de postes normalisée (ex: "1,5,6,7,8") depuis le libellé.
   * @param {string} label
   * @returns {string}
   */
  static extractPostesKey(label) {
    const raw = String(label || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    const m = raw.match(/\bpostes?\b[\s:,-]*([\d\s,etàa\-–—]+)/i);
    if (!m) return '';
    const found = new Set();
    const nums = String(m[1] || '').match(/\d+/g) || [];
    nums.forEach((n) => found.add(parseInt(n, 10)));
    return [...found]
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
      .join(',');
  }

  /**
   * Regroupe les options partageant la même clé de famille (≥ 2 lignes = exclusivité).
   * @param {Array<{ id: string, name: string, refUgap?: string, optionFamilyKey?: string }>} options
   * @returns {Array<{ familyKey: string, options: Array<{ id: string, name: string, refUgap: string }> }>}
   */
  static buildOptionFamilyGroups(options) {
    const map = new Map();
    for (const opt of options || []) {
      const k = opt.optionFamilyKey;
      if (!k || typeof k !== 'string') continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push({
        id: opt.id,
        name: opt.name || '',
        refUgap: opt.refUgap || ''
      });
    }
    return [...map.entries()]
      .filter(([, arr]) => arr.length > 1)
      .map(([familyKey, opts]) => ({ familyKey, options: opts }));
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
    const baseRowIndices = new Set();
    structure.modelCols.forEach((colIdx) => {
      const nameFallback = this.extractModelName(raw, colIdx, structure.headerRowIndex);
      const priceCol = structure.priceClientCol > -1 ? structure.priceClientCol : structure.priceUgapCol;
      const baseData = this.extractBaseModelData(
        raw,
        colIdx,
        structure.labelCol,
        priceCol,
        startRow
      );
      if (baseData.rowIndex >= 0) {
        baseRowIndices.add(baseData.rowIndex);
      }

      models.push({
        id: `model_${colIdx}`,
        colIndex: colIdx,
        name: baseData.modelName || nameFallback,
        basePrice: baseData.basePrice,
        baseLabel: baseData.label || '',
        motorizationBase: baseData.motorizationBase || '',
        posteNumber: baseData.posteNumber,
        defaultDeliveryMode: baseData.deliveryMode || ''
      });
    });

    // 2. Extraire les options
    const optionsMap = new Map(); // id -> option
    const categoriesMap = new Map(); // categoryName -> { id, name, options: [] }

    for (let r = startRow; r < raw.length; r++) {
      if (baseRowIndices.has(r)) continue;

      const row = raw[r] || [];
      const label = row[structure.labelCol];

      if (!label || typeof label !== 'string' || label.trim().length === 0) continue;

      const labelStr = String(label).trim();

      // Ignorer uniquement les lignes "base modèle" (éviter faux positifs comme "embase")
      const labelLower = labelStr.toLowerCase();
      const isBaseModelRow =
        /^poste\b/.test(labelLower) ||
        /\bconfiguration de base\b/.test(labelLower) ||
        /^\s*base\s*$/.test(labelLower);
      if (isBaseModelRow) continue;

      const priceClient = this.parsePrice(row[structure.priceClientCol] || row[structure.priceUgapCol]);
      const priceUgap = structure.priceUgapCol > -1 ? this.parsePrice(row[structure.priceUgapCol]) : priceClient;
      const refUgapRaw = structure.refUgapCol > -1 ? row[structure.refUgapCol] : null;
      const refUgap = (typeof refUgapRaw === 'string' || typeof refUgapRaw === 'number')
        ? String(refUgapRaw).trim()
        : '';

      // Déterminer la catégorie (sera amélioré avec l'IA)
      const category = this.determineCategory(labelStr);

      const isMinorationRow = UgapImportAssignmentService.isMinorationLine(labelStr, refUgap);
      const optionFamilyKey = this.computeOptionFamilyKey(labelStr);
      const isPrRow = /^PR\s/i.test(labelStr);

      const refFournisseurRaw = structure.refFournisseurCol > -1 ? row[structure.refFournisseurCol] : null;
      const refFournisseur = (typeof refFournisseurRaw === 'string' || typeof refFournisseurRaw === 'number')
        ? String(refFournisseurRaw).trim()
        : '';

      // Croix Excel : catalogue + minorations moteur (postes concernés). Pas pour les PR.
      const compatibleModels = [];
      if (!isPrRow) {
        structure.modelCols.forEach((modelCol) => {
          const val = row[modelCol];
          if (this.isCrossMarker(val)) {
            const model = models.find(m => m.colIndex === modelCol);
            if (model) compatibleModels.push(model.id);
          }
        });
      }

      const finalCompatibleModels = compatibleModels;

      const baseReplacement = this.parseBaseReplacementProducts(labelStr);

            const option = {
                id: `opt_${r}`,
                name: labelStr,
                priceClient: priceClient,
                priceUgap: priceUgap,
                refUgap: refUgap,
                refFournisseur: refFournisseur,
                category: category,
                compatibleModels: finalCompatibleModels,
                isMinoration: isMinorationRow,
                subCategory: null, // Sera rempli par l'IA ou manuellement
                optionFamilyKey,
                changeType: baseReplacement.changeType,
                initialProduct: baseReplacement.initialProduct,
                finalProduct: baseReplacement.finalProduct
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

        const allOptionsFlat = categories.flatMap((c) => c.options || []);
        const optionFamilyGroups = this.buildOptionFamilyGroups(allOptionsFlat);

        return {
            models,
            categories,
            structure,
            optionFamilyGroups
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

  static buildImportAudit(filePath, data = null) {
    const raw = this.readExcelFile(filePath);
    const structure = this.detectStructure(raw);
    if (structure.headerRowIndex === -1) {
      throw new Error('Impossible de detecter la structure du fichier Excel pour audit');
    }

    const startRow = structure.headerRowIndex + 1;
    const priceCol = structure.priceClientCol > -1 ? structure.priceClientCol : structure.priceUgapCol;

    const models = [];
    const baseRowIndices = new Set();
    structure.modelCols.forEach((colIdx) => {
      const nameFallback = this.extractModelName(raw, colIdx, structure.headerRowIndex);
      const baseData = this.extractBaseModelData(raw, colIdx, structure.labelCol, priceCol, startRow);
      if (baseData.rowIndex >= 0) baseRowIndices.add(baseData.rowIndex);
      models.push({
        id: `model_${colIdx}`,
        colIndex: colIdx,
        name: baseData.modelName || nameFallback
      });
    });

    const parsedByModel = new Map();
    if (data && Array.isArray(data.categories)) {
      (data.categories || []).forEach((category) => {
        (category.options || []).forEach((opt) => {
          const ids = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [];
          ids.forEach((mid) => {
            if (!parsedByModel.has(mid)) parsedByModel.set(mid, []);
            parsedByModel.get(mid).push(opt);
          });
        });
      });
    }

    const isMinorationLine = (label, refUgap) =>
      UgapImportAssignmentService.isMinorationLine(label, refUgap);

    const reports = models.map((model) => {
      let crosses = 0;
      let skippedBaseModelRow = 0;
      let skippedEmptyLabel = 0;
      let skippedBaseRowLabel = 0;
      let prCount = 0;
      let minorationCount = 0;
      let optionCount = 0;
      const excludedRows = [];

      for (let r = startRow; r < raw.length; r++) {
        const row = raw[r] || [];
        if (!this.isCrossMarker(row[model.colIndex])) continue;
        crosses += 1;

        if (baseRowIndices.has(r)) {
          skippedBaseModelRow += 1;
          excludedRows.push({
            rowIndex: r,
            label: String(row[structure.labelCol] || '').trim(),
            reason: 'base_model_row_marker',
            reasonLabel: 'Ligne de base modele',
            reintegrable: true
          });
          continue;
        }

        const label = row[structure.labelCol];
        const labelStr = typeof label === 'string' ? label.trim() : '';
        if (!labelStr) {
          skippedEmptyLabel += 1;
          excludedRows.push({
            rowIndex: r,
            label: '',
            reason: 'empty_label',
            reasonLabel: 'Libelle vide',
            reintegrable: false
          });
          continue;
        }

        const labelLower = labelStr.toLowerCase();
        const isBaseModelRow =
          /^poste\b/.test(labelLower) ||
          /\bconfiguration de base\b/.test(labelLower) ||
          /^\s*base\s*$/.test(labelLower);
        if (isBaseModelRow) {
          skippedBaseRowLabel += 1;
          excludedRows.push({
            rowIndex: r,
            label: labelStr,
            reason: 'base_row_label',
            reasonLabel: 'Ligne de base (filtre label)',
            reintegrable: true
          });
          continue;
        }

        const refRaw = structure.refUgapCol > -1 ? row[structure.refUgapCol] : null;
        const refUgap = (typeof refRaw === 'string' || typeof refRaw === 'number') ? String(refRaw).trim() : '';
        if (/^PR\s/i.test(labelStr)) {
          prCount += 1;
        } else if (isMinorationLine(labelStr, refUgap)) {
          minorationCount += 1;
        } else {
          optionCount += 1;
        }
      }

      const parsedRows = parsedByModel.get(model.id) || [];
      let parsedPr = 0;
      let parsedMino = 0;
      let parsedOption = 0;
      parsedRows.forEach((opt) => {
        const label = String(opt?.name || '').trim();
        const ref = String(opt?.refUgap || '').trim();
        if (/^PR\s/i.test(label)) parsedPr += 1;
        else if (isMinorationLine(label, ref)) parsedMino += 1;
        else parsedOption += 1;
      });

      return {
        modelId: model.id,
        modelName: model.name,
        excel: {
          crosses,
          options: optionCount,
          pr: prCount,
          minorations: minorationCount,
          skippedBaseModelRow,
          skippedEmptyLabel,
          skippedBaseRowLabel
        },
        parsed: {
          totalAssigned: parsedRows.length,
          options: parsedOption,
          pr: parsedPr,
          minorations: parsedMino
        },
        deltas: {
          options: parsedOption - optionCount,
          pr: parsedPr - prCount,
          minorations: parsedMino - minorationCount
        },
        excludedRows
      };
    });

    return {
      filePath,
      modelCount: models.length,
      reports
    };
  }

  static reintegrateExcludedRow(filePath, data, { modelId, rowIndex }) {
    if (!data || !Array.isArray(data.models) || !Array.isArray(data.categories)) {
      throw new Error('Donnees UGAP invalides');
    }
    const targetModel = (data.models || []).find((m) => String(m?.id || '') === String(modelId || ''));
    if (!targetModel) {
      throw new Error('Modele introuvable');
    }
    const rowIdx = Number(rowIndex);
    if (!Number.isInteger(rowIdx) || rowIdx < 0) {
      throw new Error('rowIndex invalide');
    }

    const raw = this.readExcelFile(filePath);
    const structure = this.detectStructure(raw);
    const row = raw[rowIdx] || [];
    if (!this.isCrossMarker(row[targetModel.colIndex])) {
      throw new Error('La ligne n\'a pas de croix pour ce modele');
    }

    const label = row[structure.labelCol];
    const labelStr = typeof label === 'string' ? label.trim() : '';
    if (!labelStr) {
      throw new Error('Impossible de reintegrer une ligne sans libelle');
    }

    const priceClient = this.parsePrice(row[structure.priceClientCol] || row[structure.priceUgapCol]);
    const priceUgap = structure.priceUgapCol > -1 ? this.parsePrice(row[structure.priceUgapCol]) : priceClient;
    const refUgapRaw = structure.refUgapCol > -1 ? row[structure.refUgapCol] : null;
    const refUgap = (typeof refUgapRaw === 'string' || typeof refUgapRaw === 'number')
      ? String(refUgapRaw).trim()
      : '';
    const optionId = `opt_${rowIdx}`;
    const categoryName = this.determineCategory(labelStr);
    const optionFamilyKey = this.computeOptionFamilyKey(labelStr);
    const baseReplacement = this.parseBaseReplacementProducts(labelStr);

    let found = null;
    let foundCategory = null;
    (data.categories || []).forEach((cat) => {
      const opt = (cat.options || []).find((o) => String(o?.id || '') === optionId);
      if (opt && !found) {
        found = opt;
        foundCategory = cat;
      }
    });

    if (found) {
      const ids = new Set(Array.isArray(found.compatibleModels) ? found.compatibleModels : []);
      ids.add(targetModel.id);
      found.compatibleModels = Array.from(ids);
      if (!found.refUgap) found.refUgap = refUgap;
      if (!found.name) found.name = labelStr;
      return { updated: true, created: false, optionId, categoryId: foundCategory?.id || null };
    }

    const newOption = {
      id: optionId,
      name: labelStr,
      priceClient,
      priceUgap,
      refUgap,
      category: categoryName,
      compatibleModels: [targetModel.id],
      subCategory: null,
      optionFamilyKey,
      changeType: baseReplacement.changeType,
      initialProduct: baseReplacement.initialProduct,
      finalProduct: baseReplacement.finalProduct
    };

    const categorySlug = String(categoryName || 'Divers')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/^_+|_+$/g, '');
    let category = (data.categories || []).find((c) => String(c?.name || '') === categoryName);
    if (!category) {
      category = {
        id: `cat_${categorySlug || 'divers'}`,
        name: categoryName,
        options: [],
        subCategories: []
      };
      data.categories.push(category);
    }
    category.options = Array.isArray(category.options) ? category.options : [];
    category.options.push(newOption);
    return { updated: true, created: true, optionId, categoryId: category.id };
  }
}

module.exports = UgapExcelService;
