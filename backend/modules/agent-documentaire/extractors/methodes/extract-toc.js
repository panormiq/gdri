/**
 * Méthode d'extraction : Table des matières (TOC)
 * Fichier : backend/modules/agent-documentaire/extractors/methodes/extract-toc.js
 * 
 * Fonction : Extrait la table des matières du document Word
 */

const WordParser = require('../word-parser');
const { getTagConfig } = require('../word-tags-config');

class ExtractToc {
  /**
   * Extrait le TOC depuis le XML Word
   * @param {Object} documentObj - Objet XML parsé du document
   * @param {Object} documentStyles - Styles généraux du document (depuis word/styles.xml)
   * @param {Object} styleHierarchy - Hiérarchie des styles de titres
   * @returns {Promise<Object>} { toc, tocFound, method, tocStyles, tocInstruction, expectedTitlesCount }
   */
  static async extract(documentObj, documentStyles = {}, styleHierarchy = null) {
    const toc = [];
    let tocFound = false;
    let method = 'none';
    const tocStyles = [];
    let tocInstruction = null;
    
    const body = WordParser.getBody(documentObj);
    if (!body) {
      console.warn('⚠️  Corps du document (w:body) non trouvé');
      return {
        toc,
        tocFound: false,
        method: 'none',
        tocStyles: [],
        tocInstruction: null,
        expectedTitlesCount: 0
      };
    }
    
    console.log('📑 Extraction du sommaire...');
    
    // Récupérer tous les éléments de premier niveau
    const topLevelElements = WordParser.getTopLevelElements(body);
    console.log(`📄 ${topLevelElements.length} éléments de premier niveau trouvés`);
    
    // Pour chaque paragraphe, vérifier s'il fait partie du TOC
    for (const { tag, element } of topLevelElements) {
      if (tag === 'w:p') {
        const text = WordParser.extractText(element);
        const styleId = WordParser.getParagraphStyle(element);
        
        // Vérifier si c'est un style TMX (table des matières)
        const isTocStyle = styleId && /^TM\d+$/i.test(styleId);
        
        if (isTocStyle) {
          if (!tocStyles.includes(styleId)) {
            tocStyles.push(styleId);
          }
          
          if (text) {
            tocFound = true;
            method = 'tmx-styles';
            
            const level = this.extractLevelFromTocStyle(styleId);
            const numberingInfo = this.extractNumbering(text);
            const title = numberingInfo ? numberingInfo.text : text;
            const numbering = numberingInfo ? numberingInfo.full : null;
            
            toc.push({
              title: title,
              numbering: numbering,
              level: level,
              anchor: null,
              pageNumber: null,
              sectionId: null,
              isAnnex: false
            });
          }
        }
      }
    }
    
    console.log(`📑 TOC existant trouvé : ${toc.length} entrées`);
    if (tocStyles.length > 0) {
      console.log(`📋 Styles TMX détectés dans le TOC : ${tocStyles.join(', ')} (${tocStyles.length} niveaux)`);
    }
    
    return {
      toc,
      tocFound,
      method,
      tocStyles,
      tocInstruction,
      expectedTitlesCount: toc.length
    };
  }
  
  /**
   * Extrait la numérotation d'un titre
   * Supporte les formats : I., II., III., 1., 1.1., I.1., I.1.1., etc.
   * @param {string} title - Titre à analyser
   * @returns {Object|null} { level1, level2, full, text } ou null
   */
  static extractNumbering(title) {
    if (!title) return null;
    
    // Pattern pour chiffres romains : I., II., III., etc.
    const romanPattern = /^([IVX]+)\./i;
    const romanMatch = title.match(romanPattern);
    
    if (romanMatch) {
      const level1 = romanMatch[1];
      const rest = title.substring(romanMatch[0].length);
      
      // Pattern pour chiffres arabes : 1., 1.1., etc.
      const arabicPattern = /^(\d+(?:\.\d+)*)\.?\s*/;
      const arabicMatch = rest.match(arabicPattern);
      
      if (arabicMatch) {
        return {
          level1: level1,
          level2: arabicMatch[1],
          full: `${level1}.${arabicMatch[1]}.`,
          text: rest.substring(arabicMatch[0].length)
        };
      } else {
        // Juste niveau 1 (ex: "II. INTRODUCTION")
        return {
          level1: level1,
          level2: null,
          full: `${level1}.`,
          text: rest.trim()
        };
      }
    }
    
    // Pattern pour chiffres arabes uniquement : 1., 1.1., etc.
    const arabicOnlyPattern = /^(\d+(?:\.\d+)*)\.?\s*/;
    const arabicOnlyMatch = title.match(arabicOnlyPattern);
    
    if (arabicOnlyMatch) {
      return {
        level1: null,
        level2: arabicOnlyMatch[1],
        full: `${arabicOnlyMatch[1]}.`,
        text: title.substring(arabicOnlyMatch[0].length)
      };
    }
    
    return null;
  }
  
  /**
   * Extrait le niveau depuis un style TMX (TM1 = niveau 1, TM2 = niveau 2, etc.)
   */
  static extractLevelFromTocStyle(styleId) {
    if (!styleId) return 1;
    const match = styleId.match(/TM(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  }
  
  /**
   * Extrait le niveau depuis le texte TOC (basé sur l'indentation ou le format)
   */
  static extractLevelFromTocText(text) {
    if (!text) return 1;
    
    const numbering = this.extractNumbering(text);
    if (numbering) {
      if (numbering.level2) {
        // Compter les points dans level2 pour déterminer le niveau
        const dots = (numbering.level2.match(/\./g) || []).length;
        return dots + 2; // I.1. = niveau 2, I.1.1. = niveau 3
      } else if (numbering.level1) {
        return 1; // I. = niveau 1
      }
    }
    
    return 1;
  }
  
  /**
   * Vérifie si un titre est "ANNEXES" ou similaire
   */
  static isAnnexesSectionTitle(title) {
    if (!title || typeof title !== 'string') return false;
    const normalized = title.trim().toUpperCase();
    return normalized === 'ANNEXES' || 
           normalized === 'ANNEXE' || 
           normalized === 'ANNEX' ||
           normalized === 'APPENDIX';
  }
  
  /**
   * Vérifie si un titre est "Sommaire" ou similaire
   */
  static isSommaireTitle(title) {
    if (!title || typeof title !== 'string') return false;
    const normalized = title.trim().toLowerCase();
    return normalized === 'sommaire' || 
           normalized === 'table des matières' ||
           normalized === 'table des matieres' ||
           normalized === 'contents';
  }
  
  /**
   * Extrait le numéro de page depuis un texte TOC
   */
  static extractPageNumber(text) {
    if (!text) return null;
    // Pattern pour trouver un numéro à la fin (généralement le numéro de page)
    const match = text.match(/\s+(\d+)\s*$/);
    return match ? parseInt(match[1], 10) : null;
  }
  
  /**
   * Convertit un nombre en chiffre romain
   */
  static numberToRoman(num) {
    const romanNumerals = [
      { value: 1000, numeral: 'M' },
      { value: 900, numeral: 'CM' },
      { value: 500, numeral: 'D' },
      { value: 400, numeral: 'CD' },
      { value: 100, numeral: 'C' },
      { value: 90, numeral: 'XC' },
      { value: 50, numeral: 'L' },
      { value: 40, numeral: 'XL' },
      { value: 10, numeral: 'X' },
      { value: 9, numeral: 'IX' },
      { value: 5, numeral: 'V' },
      { value: 4, numeral: 'IV' },
      { value: 1, numeral: 'I' }
    ];
    
    let result = '';
    for (const { value, numeral } of romanNumerals) {
      while (num >= value) {
        result += numeral;
        num -= value;
      }
    }
    return result;
  }
  
  /**
   * Vérifie si un titre est un titre d'annexe (commence par un chiffre romain d'annexe)
   */
  static isAnnexTitle(title) {
    if (!title) return false;
    const numbering = this.extractNumbering(title);
    if (!numbering || !numbering.level1) return false;
    
    // Les annexes commencent généralement à partir de IV ou V
    const roman = numbering.level1.toUpperCase();
    const annexRomans = ['IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return annexRomans.includes(roman);
  }
}

module.exports = ExtractToc;

