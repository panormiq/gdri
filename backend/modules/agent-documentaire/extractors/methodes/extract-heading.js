/**
 * Méthode d'extraction : Titre
 * Fichier : backend/modules/agent-documentaire/extractors/methodes/extract-heading.js
 * 
 * Fonction : Extrait un titre Word et son niveau
 */

const WordParser = require('../word-parser');
const StyleExtractor = require('../style-extractor');

class ExtractHeading {
  /**
   * Extrait un titre depuis le XML Word
   * @param {Object} headingXml - Élément XML du titre (w:p avec style Heading)
   * @param {Object} documentStyles - Styles généraux du document (depuis word/styles.xml)
   * @returns {Object} Titre extrait
   */
  static extract(headingXml, documentStyles = {}) {
    if (!headingXml || typeof headingXml !== 'object') {
      return ExtractHeading.getDefaultHeading();
    }

    // Extraire le texte du titre
    const text = WordParser.extractText(headingXml);
    
    // Déterminer le niveau du titre depuis le style
    const styleName = WordParser.getParagraphStyle(headingXml);
    let level = 1;
    if (styleName && styleName.startsWith('Heading')) {
      const levelMatch = styleName.match(/Heading(\d+)/);
      if (levelMatch) {
        level = parseInt(levelMatch[1]) || 1;
      }
    }

    // Extraire les propriétés de paragraphe (w:pPr)
    const pPr = headingXml['w:pPr'];
    const pPrArray = Array.isArray(pPr) ? pPr : (pPr ? [pPr] : []);
    const paragraphProps = ExtractHeading.extractParagraphProperties(pPrArray[0] || {}, documentStyles, styleName);

    // Extraire les propriétés de run (w:rPr) depuis tous les runs
    const runs = WordParser.findElementsByTag(headingXml, 'w:r');
    const runProps = ExtractHeading.extractRunProperties(runs, documentStyles, styleName);

    return {
      type: 'heading',
      id: `heading_${Date.now()}_${Math.random()}`,
      text: text,
      level: level,
      styles: {
        ...runProps,
        ...paragraphProps
      }
    };
  }

  /**
   * Extrait les propriétés de paragraphe depuis w:pPr
   * @param {Object} pPr - Élément w:pPr
   * @param {Object} documentStyles - Styles généraux
   * @param {string} styleName - Nom du style (ex: "Heading1")
   * @returns {Object} Propriétés de paragraphe
   */
  static extractParagraphProperties(pPr, documentStyles, styleName) {
    // Récupérer le style général comme base
    const baseStyle = documentStyles[styleName] || {};
    const baseParagraphProps = baseStyle.paragraph || {};

    const props = {
      alignment: baseParagraphProps.alignment || 'left',
      spacing: {
        before: baseParagraphProps.spacing?.before || 0,
        after: baseParagraphProps.spacing?.after || 0,
        line: baseParagraphProps.spacing?.line || 1.15
      },
      indentation: {
        left: baseParagraphProps.indentation?.left || 0,
        right: baseParagraphProps.indentation?.right || 0,
        firstLine: baseParagraphProps.indentation?.firstLine || 0
      }
    };

    if (!pPr || typeof pPr !== 'object') {
      return props;
    }

    // Alignement (w:jc)
    const jc = pPr['w:jc']?.[0]?.['$']?.['w:val'];
    if (jc) {
      const alignmentMap = {
        'left': 'left',
        'center': 'center',
        'right': 'right',
        'both': 'justify',
        'justify': 'justify'
      };
      props.alignment = alignmentMap[jc] || 'left';
    }

    // Interlignes et marges (w:spacing)
    const spacing = pPr['w:spacing']?.[0]?.['$'];
    if (spacing) {
      if (spacing['w:before']) {
        props.spacing.before = StyleExtractor.twipsToPoints(parseInt(spacing['w:before']) || 0);
      }
      if (spacing['w:after']) {
        props.spacing.after = StyleExtractor.twipsToPoints(parseInt(spacing['w:after']) || 0);
      }
      if (spacing['w:line']) {
        const lineValue = spacing['w:line'];
        const lineRule = spacing['w:lineRule']; // "auto", "exact", "atLeast"
        
        if (lineValue === 'auto') {
          props.spacing.line = 1.15;
          props.spacing.lineType = 'multiple';
        } else if (lineRule === 'exact' || lineRule === 'atLeast') {
          // Valeur fixe en twips (1/20 de point)
          const lineInTwips = parseInt(lineValue) || 0;
          props.spacing.line = StyleExtractor.twipsToPoints(lineInTwips);
          props.spacing.lineType = 'fixed';
        } else {
          // Multiple en 240èmes de ligne
          props.spacing.line = parseInt(lineValue) / 240;
          props.spacing.lineType = 'multiple';
        }
      }
    }

    // Indentation (w:ind)
    const ind = pPr['w:ind']?.[0]?.['$'];
    if (ind) {
      if (ind['w:left']) {
        props.indentation.left = StyleExtractor.twipsToPoints(parseInt(ind['w:left']) || 0);
      }
      if (ind['w:right']) {
        props.indentation.right = StyleExtractor.twipsToPoints(parseInt(ind['w:right']) || 0);
      }
      if (ind['w:firstLine']) {
        props.indentation.firstLine = StyleExtractor.twipsToPoints(parseInt(ind['w:firstLine']) || 0);
      }
      if (ind['w:hanging']) {
        props.indentation.firstLine = -StyleExtractor.twipsToPoints(parseInt(ind['w:hanging']) || 0);
      }
    }

    return props;
  }

  /**
   * Extrait les propriétés de run depuis tous les w:r
   * Fusionne les propriétés de tous les runs
   * @param {Array} runs - Liste des éléments w:r
   * @param {Object} documentStyles - Styles généraux
   * @param {string} styleName - Nom du style
   * @returns {Object} Propriétés de run fusionnées
   */
  static extractRunProperties(runs, documentStyles, styleName) {
    // Récupérer le style général comme base
    const baseStyle = documentStyles[styleName] || {};
    const baseRunProps = baseStyle.run || {};

    const props = {
      bold: baseRunProps.bold || false,
      italic: baseRunProps.italic || false,
      underline: baseRunProps.underline || false,
      fontSize: baseRunProps.fontSize || 16,
      fontFamily: baseRunProps.fontFamily || 'Arial',
      color: baseRunProps.color || '#000000',
      caps: baseRunProps.caps || false
    };

    // Parcourir tous les runs et fusionner les propriétés
    for (const run of runs) {
      if (!run || typeof run !== 'object') {
        continue;
      }

      const rPr = run['w:rPr'];
      if (!rPr) {
        continue;
      }

      const rPrArray = Array.isArray(rPr) ? rPr : [rPr];
      for (const rPrItem of rPrArray) {
        // Gras (w:b)
        if (rPrItem['w:b']) {
          props.bold = true;
        }
        // Italique (w:i)
        if (rPrItem['w:i']) {
          props.italic = true;
        }
        // Souligné (w:u)
        const underline = rPrItem['w:u']?.[0]?.['$']?.['w:val'];
        if (underline && underline !== 'none') {
          props.underline = true;
        }
        // Taille de police (w:sz)
        const sz = rPrItem['w:sz']?.[0]?.['$']?.['w:val'];
        if (sz) {
          props.fontSize = parseInt(sz) / 2; // w:sz est en demi-points
        }
        // Police (w:rFonts)
        const rFonts = rPrItem['w:rFonts']?.[0]?.['$']?.['w:ascii'] || 
                       rPrItem['w:rFonts']?.[0]?.['$']?.['w:hAnsi'];
        if (rFonts) {
          props.fontFamily = rFonts;
        }
        // Couleur (w:color)
        const color = rPrItem['w:color']?.[0]?.['$']?.['w:val'];
        if (color) {
          props.color = '#' + color;
        }
        // Majuscules (w:caps)
        if (rPrItem['w:caps']) {
          props.caps = true;
        }
      }
    }

    return props;
  }

  /**
   * Retourne un titre par défaut
   * @returns {Object} Titre par défaut
   */
  static getDefaultHeading() {
    return {
      type: 'heading',
      id: `heading_${Date.now()}_${Math.random()}`,
      text: '',
      level: 1,
      styles: {
        fontSize: 16,
        fontFamily: 'Arial',
        bold: true,
        italic: false,
        underline: false,
        color: '#000000',
        alignment: 'left',
        spacing: {
          before: 12,
          after: 6,
          line: 1.15
        }
      }
    };
  }
}

module.exports = ExtractHeading;
