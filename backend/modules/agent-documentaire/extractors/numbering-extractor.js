/**
 * Numbering Extractor - Extraction des styles de numérotation depuis numbering.xml
 * Fichier : backend/modules/agent-documentaire/extractors/numbering-extractor.js
 * 
 * Fonction : Extrait et convertit les styles de numérotation Word
 */

const xml2js = require('xml2js');

class NumberingExtractor {
  /**
   * Extrait les styles de numérotation depuis numbering.xml
   * @param {string} numberingXml - Contenu XML de numbering.xml
   * @returns {Promise<Object>} Objet contenant les formats de numérotation par niveau
   */
  static async extract(numberingXml) {
    if (!numberingXml) {
      console.log('⚠️  Fichier numbering.xml non trouvé, utilisation des formats par défaut');
      return this.getDefaultNumberingFormats();
    }

    const parser = new xml2js.Parser({
      explicitArray: true,
      mergeAttrs: false,
      explicitRoot: false,
      attrkey: '$',
      charkey: '_'
    });

    try {
      const numberingObj = await parser.parseStringPromise(numberingXml);
      const numberingFormats = {};
      
      // Extraire les abstractNum (formats de numérotation abstraits)
      const abstractNums = numberingObj['w:abstractNum'] || [];
      const nums = numberingObj['w:num'] || [];
      
      // Créer un mapping numId -> abstractNumId
      const numIdToAbstractNumId = {};
      for (const num of nums) {
        const numId = num['$']?.['w:numId'];
        const abstractNumId = num['w:abstractNumId']?.[0]?.['$']?.['w:val'];
        if (numId && abstractNumId) {
          numIdToAbstractNumId[numId] = abstractNumId;
          console.log(`   Mapping numId ${numId} -> abstractNumId ${abstractNumId}`);
        }
      }
      
      // Stocker tous les abstractNum avec leur ID pour pouvoir les récupérer plus tard
      const abstractNumMap = {};
      for (const abstractNum of abstractNums) {
        const abstractNumId = abstractNum['$']?.['w:abstractNumId'];
        if (abstractNumId) {
          abstractNumMap[abstractNumId] = abstractNum;
          const levels = abstractNum['w:lvl'] || [];
          console.log(`   AbstractNum ${abstractNumId} avec ${levels.length} niveaux`);
        }
      }
      
      // Extraire les formats depuis le premier abstractNum trouvé (pour compatibilité)
      // Mais on stocke aussi tous les abstractNum pour pouvoir les utiliser selon le numId
      let mainAbstractNum = null;
      let maxLevels = 0;
      
      for (const abstractNum of abstractNums) {
        const levels = abstractNum['w:lvl'] || [];
        if (levels.length > maxLevels) {
          maxLevels = levels.length;
          mainAbstractNum = abstractNum;
        }
      }
      
      // Extraire les formats depuis l'abstractNum principal (pour compatibilité)
      if (mainAbstractNum) {
        const levels = mainAbstractNum['w:lvl'] || [];
        for (const level of levels) {
          const levelIndex = parseInt(level['$']?.['w:ilvl']) || 0;
          const format = this.extractLevelFormat(level);
          
          numberingFormats[levelIndex] = {
            level: levelIndex,
            format: format.format,
            start: format.start || 1,
            numFmt: format.numFmt, // decimal, upperRoman, lowerRoman, etc.
            ...format
          };
        }
      }
      
      console.log(`✅ ${Object.keys(numberingFormats).length} formats de numérotation extraits`);
      
      // Log des formats extraits pour debug
      for (const [levelIndex, format] of Object.entries(numberingFormats)) {
        console.log(`   Niveau ${levelIndex}: format="${format.format}", numFmt="${format.numFmt}"`);
      }
      
      return {
        formats: numberingFormats,
        numIdMapping: numIdToAbstractNumId,
        abstractNumMap: abstractNumMap // Tous les abstractNum indexés par leur ID
      };
    } catch (error) {
      console.error('❌ Erreur parsing numbering.xml:', error.message);
      return this.getDefaultNumberingFormats();
    }
  }

  /**
   * Extrait le format d'un niveau de numérotation
   * @param {Object} level - Élément w:lvl
   * @param {number} levelIndex - Index du niveau (optionnel, pour debug)
   * @returns {Object} Format de numérotation
   */
  static extractLevelFormat(level, levelIndexParam = null) {
    const numFmt = level['w:numFmt']?.[0]?.['$']?.['w:val'] || 'decimal';
    const start = parseInt(level['w:start']?.[0]?.['$']?.['w:val']) || 1;
    const text = level['w:lvlText']?.[0]?.['$']?.['w:val'] || '%1.';
    const levelIndex = levelIndexParam !== null ? levelIndexParam : (parseInt(level['$']?.['w:ilvl']) || 0);
    
    // Dans Word, w:lvlText contient le format avec des placeholders
    // %1 = niveau actuel (celui défini par w:ilvl)
    // %2 = niveau parent (w:ilvl - 1)
    // %3 = niveau grand-parent (w:ilvl - 2), etc.
    // 
    // MAIS : si le format contient "%1" pour le niveau 0, cela signifie le niveau 0
    // Si le format contient "%2" pour le niveau 1, cela signifie le niveau 1 (pas le niveau 2!)
    // 
    // En fait, dans Word, les placeholders dans w:lvlText sont relatifs au niveau actuel :
    // - Pour le niveau 0 : %1 = niveau 0, %2 = niveau 1, etc.
    // - Pour le niveau 1 : %1 = niveau 1, %2 = niveau 2, etc.
    // 
    // Mais en réalité, Word utilise %1 pour le niveau actuel, %2 pour le niveau parent, etc.
    // Donc pour le niveau 0, %1 = niveau 0
    // Pour le niveau 1, %1 = niveau 1, %2 = niveau 0 (parent)
    
    // Le format extrait est correct tel quel
    let format = text;
    
    // Log pour debug
    console.log(`   📝 Niveau ${levelIndex}: w:lvlText="${text}", w:numFmt="${numFmt}"`);
    
    return {
      format: format,
      numFmt: numFmt, // decimal, upperRoman, lowerRoman, upperLetter, lowerLetter, etc.
      start: start,
      text: text
    };
  }

  /**
   * Génère un numéro de numérotation selon le format et le niveau
   * @param {number} level - Niveau (0-8)
   * @param {number} number - Numéro à formater
   * @param {string} numFmt - Format Word (decimal, upperRoman, lowerRoman, etc.)
   * @returns {string} Numéro formaté
   */
  static formatNumber(number, numFmt = 'decimal') {
    switch (numFmt) {
      case 'decimal':
        return number.toString();
      case 'upperRoman':
        return this.toRoman(number).toUpperCase();
      case 'lowerRoman':
        return this.toRoman(number).toLowerCase();
      case 'upperLetter':
        return this.toLetter(number - 1).toUpperCase();
      case 'lowerLetter':
        return this.toLetter(number - 1).toLowerCase();
      case 'ordinal':
        return this.toOrdinal(number);
      default:
        return number.toString();
    }
  }

  /**
   * Convertit un nombre en chiffres romains
   * @param {number} num - Nombre à convertir
   * @returns {string} Chiffres romains
   */
  static toRoman(num) {
    const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const numerals = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
    let result = '';
    
    for (let i = 0; i < values.length; i++) {
      while (num >= values[i]) {
        result += numerals[i];
        num -= values[i];
      }
    }
    
    return result;
  }

  /**
   * Convertit un index en lettre (0=A, 1=B, etc.)
   * @param {number} index - Index (0-based)
   * @returns {string} Lettre
   */
  static toLetter(index) {
    let result = '';
    while (index >= 0) {
      result = String.fromCharCode(97 + (index % 26)) + result;
      index = Math.floor(index / 26) - 1;
    }
    return result;
  }

  /**
   * Convertit un nombre en ordinal (1st, 2nd, 3rd, etc.)
   * @param {number} num - Nombre
   * @returns {string} Ordinal
   */
  static toOrdinal(num) {
    const suffix = ['th', 'st', 'nd', 'rd'];
    const v = num % 100;
    return num + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
  }

  /**
   * Retourne les formats de numérotation par défaut
   * @returns {Object} Formats par défaut
   */
  static getDefaultNumberingFormats() {
    return {
      formats: {
        0: { level: 0, format: '%1.', numFmt: 'upperRoman', start: 1, text: '%1.' }, // I., II., III.
        1: { level: 1, format: '%1.', numFmt: 'decimal', start: 1, text: '%1.' }, // 1., 2., 3.
        2: { level: 2, format: '%1.%2.', numFmt: 'decimal', start: 1, text: '%1.%2.' }, // 1.1., 1.2., 2.1.
        3: { level: 3, format: '%1.%2.%3.', numFmt: 'decimal', start: 1, text: '%1.%2.%3.' }, // 1.1.1., etc.
      },
      numIdMapping: {}
    };
  }
}

module.exports = NumberingExtractor;

