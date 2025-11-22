/**
 * Méthode d'extraction : Paragraphe
 * Fichier : backend/modules/agent-documentaire/extractors/methodes/extract-paragraph.js
 * 
 * Fonction : Extrait un paragraphe Word et ses styles
 */

const WordParser = require('../word-parser');
const StyleExtractor = require('../style-extractor');

class ExtractParagraph {
  /**
   * Extrait un paragraphe depuis le XML Word
   * @param {Object} paragraphXml - Élément XML du paragraphe (w:p)
   * @param {Object} documentStyles - Styles généraux du document (depuis word/styles.xml)
   * @param {Array} images - Images extraites (optionnel, pour détecter les images dans le paragraphe)
   * @param {Object} relationshipsObj - Relations du document (optionnel)
   * @returns {Object} Paragraphe extrait ou Image
   */
  static extract(paragraphXml, documentStyles = {}, images = null, relationshipsObj = null) {
    if (!paragraphXml || typeof paragraphXml !== 'object') {
      return ExtractParagraph.getDefaultParagraph();
    }

    // Vérifier s'il y a des images (w:drawing) dans ce paragraphe
    if (images && relationshipsObj) {
      const drawings = WordParser.findElementsByTag(paragraphXml, 'w:drawing');
      if (drawings && drawings.length > 0) {
        // Il y a une image dans ce paragraphe
        // Extraire d'abord les propriétés du paragraphe pour obtenir la couleur de fond
        const pPr = paragraphXml['w:pPr'];
        const pPrArray = Array.isArray(pPr) ? pPr : (pPr ? [pPr] : []);
        const styleName = WordParser.getParagraphStyle(paragraphXml) || 'Normal';
        const paragraphProps = ExtractParagraph.extractParagraphProperties(pPrArray[0] || {}, documentStyles, styleName);
        
        // Extraire l'image
        const ExtractImage = require('./extract-image');
        const imageResult = ExtractImage.extract(drawings[0], images, relationshipsObj);
        
        // Si l'image a au moins un name, on la retourne avec les propriétés du paragraphe
        if (imageResult && (imageResult.src || imageResult.name)) {
          // FORCER L'IMAGE À ÊTRE INLINE (pas absolute)
          if (imageResult.position) {
            imageResult.position.isAbsolute = false;
            imageResult.position.x = 0;
            imageResult.position.y = 0;
          }
          // Ajouter la couleur de fond du paragraphe à l'image
          if (paragraphProps.backgroundColor) {
            imageResult.paragraphBackgroundColor = paragraphProps.backgroundColor;
          }
          // Ajouter l'alignement du paragraphe à l'image
          if (paragraphProps.alignment) {
            imageResult.textAlign = paragraphProps.alignment;
          }
          return imageResult;
        }
      }
    }

    // Extraire le texte du paragraphe
    const text = WordParser.extractText(paragraphXml);
    
    // Vérifier s'il y a un saut de page dans ce paragraphe
    const hasPageBreak = ExtractParagraph.hasPageBreak(paragraphXml);
    
    // Déterminer le style du paragraphe
    const styleName = WordParser.getParagraphStyle(paragraphXml) || 'Normal';
    
    // Extraire les propriétés de paragraphe (w:pPr) - MÊME si le paragraphe est vide !
    const pPr = paragraphXml['w:pPr'];
    const pPrArray = Array.isArray(pPr) ? pPr : (pPr ? [pPr] : []);
    const paragraphProps = ExtractParagraph.extractParagraphProperties(pPrArray[0] || {}, documentStyles, styleName);
    
    // Si le paragraphe est vide, retourner quand même un paragraphe vide AVEC ses styles
    if (!text || text.trim().length === 0) {
      const emptyPar = ExtractParagraph.getEmptyParagraph();
      if (hasPageBreak) {
        emptyPar.hasPageBreak = true;
      }
      // AJOUTER les styles du paragraphe vide (notamment backgroundColor et textAlign)
      emptyPar.styles = {
        ...emptyPar.styles,
        ...paragraphProps
      };
      return emptyPar;
    }

    // Extraire les propriétés de run (w:rPr) depuis tous les runs
    // Pour un paragraphe, on peut avoir plusieurs runs avec des styles différents
    // On extrait le style dominant (le plus fréquent) ou le premier
    const runs = WordParser.findElementsByTag(paragraphXml, 'w:r');
    const runProps = ExtractParagraph.extractRunProperties(runs, documentStyles, styleName);

    const paragraph = {
      type: 'paragraph',
      id: `par_${Date.now()}_${Math.random()}`,
      text: text,
      styles: {
        ...runProps,
        ...paragraphProps
      }
    };
    
    // Ajouter l'indicateur de saut de page si présent
    if (hasPageBreak) {
      paragraph.hasPageBreak = true;
    }
    
    return paragraph;
  }

  /**
   * Extrait les propriétés de paragraphe depuis w:pPr
   * @param {Object} pPr - Élément w:pPr
   * @param {Object} documentStyles - Styles généraux
   * @param {string} styleName - Nom du style (ex: "Normal")
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
      },
      backgroundColor: baseParagraphProps.backgroundColor || null
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
          // Ex: 600 twips = 30pt
          const lineInTwips = parseInt(lineValue) || 0;
          props.spacing.line = StyleExtractor.twipsToPoints(lineInTwips);
          props.spacing.lineType = 'fixed';
        } else {
          // Multiple en 240èmes de ligne (par défaut si lineRule absent ou "auto")
          // Ex: 240 = 1.0, 360 = 1.5, 480 = 2.0
          props.spacing.line = parseInt(lineValue) / 240;
          props.spacing.lineType = 'multiple';
        }
      }
    }

    // Indentation (w:ind)
    const ind = pPr['w:ind']?.[0]?.['$'];
    if (ind) {
      if (ind['w:left']) {
        // Garder TOUTES les marges (même négatives) pour fidélité à Word
        props.indentation.left = StyleExtractor.twipsToPoints(parseInt(ind['w:left']) || 0);
      }
      if (ind['w:right']) {
        // Garder TOUTES les marges (même négatives) pour fidélité à Word
        props.indentation.right = StyleExtractor.twipsToPoints(parseInt(ind['w:right']) || 0);
      }
      if (ind['w:firstLine']) {
        props.indentation.firstLine = StyleExtractor.twipsToPoints(parseInt(ind['w:firstLine']) || 0);
      }
      if (ind['w:hanging']) {
        props.indentation.firstLine = -StyleExtractor.twipsToPoints(parseInt(ind['w:hanging']) || 0);
      }
    }

    // Couleur de fond du paragraphe (w:shd)
    const shd = pPr['w:shd']?.[0]?.['$'];
    if (shd) {
      const fill = shd['w:fill'];
      // Convertir la couleur (format: RRGGBB ou auto)
      if (fill && fill !== 'auto') {
        props.backgroundColor = `#${fill}`;
      }
    }

    return props;
  }

  /**
   * Extrait les propriétés de run depuis tous les w:r
   * Pour un paragraphe, on prend le style du premier run non vide comme style dominant
   * @param {Array} runs - Liste des éléments w:r
   * @param {Object} documentStyles - Styles généraux
   * @param {string} styleName - Nom du style
   * @returns {Object} Propriétés de run
   */
  static extractRunProperties(runs, documentStyles, styleName) {
    // Récupérer le style général comme base
    const baseStyle = documentStyles[styleName] || {};
    const baseRunProps = baseStyle.run || {};

    const props = {
      bold: baseRunProps.bold || false,
      italic: baseRunProps.italic || false,
      underline: baseRunProps.underline || false,
      fontSize: baseRunProps.fontSize || 12,
      fontFamily: baseRunProps.fontFamily || 'Arial',
      color: baseRunProps.color || '#000000',
      caps: baseRunProps.caps || false,
      runBackgroundColor: baseRunProps.runBackgroundColor || null
    };

    // Parcourir les runs et prendre le style du premier run avec du texte
    for (const run of runs) {
      if (!run || typeof run !== 'object') {
        continue;
      }

      // Vérifier si le run contient du texte
      const runText = WordParser.extractText(run);
      if (!runText || runText.trim().length === 0) {
        continue;
      }

      const rPr = run['w:rPr'];
      if (!rPr) {
        // Pas de propriétés inline, utiliser le style de base
        break;
      }

      const rPrArray = Array.isArray(rPr) ? rPr : [rPr];
      for (const rPrItem of rPrArray) {
        // Gras (w:b)
        if (rPrItem['w:b']) {
          const bVal = rPrItem['w:b']?.[0]?.['$']?.['w:val'];
          if (bVal !== 'false' && bVal !== '0' && bVal !== false) {
            props.bold = true;
          }
        }
        // Italique (w:i)
        if (rPrItem['w:i']) {
          const iVal = rPrItem['w:i']?.[0]?.['$']?.['w:val'];
          if (iVal !== 'false' && iVal !== '0' && iVal !== false) {
            props.italic = true;
          }
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
        const rFonts = rPrItem['w:rFonts']?.[0]?.['$'];
        if (rFonts) {
          props.fontFamily = rFonts['w:ascii'] || rFonts['w:hAnsi'] || 'Arial';
        }
        // Couleur (w:color)
        const color = rPrItem['w:color']?.[0]?.['$']?.['w:val'];
        if (color) {
          if (color.length === 6) {
            props.color = '#' + color;
          } else if (color.startsWith('#')) {
            props.color = color;
          }
        }
        // Majuscules (w:caps)
        if (rPrItem['w:caps']) {
          const capsVal = rPrItem['w:caps']?.[0]?.['$']?.['w:val'];
          if (capsVal !== 'false' && capsVal !== '0' && capsVal !== false) {
            props.caps = true;
          }
        }
        // Couleur de fond du run (w:shd)
        const shd = rPrItem['w:shd']?.[0]?.['$'];
        if (shd && shd['w:fill']) {
          const fill = shd['w:fill'];
          // Convertir la couleur (format: RRGGBB ou auto)
          if (fill && fill !== 'auto') {
            props.runBackgroundColor = `#${fill}`;
          }
        }
      }

      // On prend le style du premier run avec du texte
      break;
    }

    return props;
  }

  /**
   * Retourne un paragraphe par défaut
   * @returns {Object} Paragraphe par défaut
   */
  static getDefaultParagraph() {
    return {
      type: 'paragraph',
      id: `par_${Date.now()}_${Math.random()}`,
      text: '',
      styles: {
        bold: false,
        italic: false,
        underline: false,
        fontSize: 12,
        fontFamily: 'Arial',
        color: '#000000',
        alignment: 'left',
        spacing: {
          before: 0,
          after: 0,
          line: 1.15
        },
        indentation: {
          left: 0,
          right: 0,
          firstLine: 0
        }
      }
    };
  }

  /**
   * Retourne un paragraphe vide (pour préserver la structure)
   * @returns {Object} Paragraphe vide
   */
  static getEmptyParagraph() {
    return {
      type: 'paragraph',
      id: `par_${Date.now()}_${Math.random()}`,
      text: '',
      styles: {
        bold: false,
        italic: false,
        underline: false,
        fontSize: 12,
        fontFamily: 'Arial',
        color: '#000000',
        alignment: 'left',
        spacing: {
          before: 0,
          after: 0,
          line: 1.15
        },
        indentation: {
          left: 0,
          right: 0,
          firstLine: 0
        }
      },
      isEmpty: true
    };
  }

  /**
   * Vérifie si un paragraphe contient un saut de page
   * @param {Object} paragraphXml - Élément XML du paragraphe (w:p)
   * @returns {boolean} True si le paragraphe contient un saut de page
   */
  static hasPageBreak(paragraphXml) {
    if (!paragraphXml || typeof paragraphXml !== 'object') {
      return false;
    }

    // Chercher w:r (runs) dans le paragraphe
    const runs = WordParser.findElementsByTag(paragraphXml, 'w:r');
    
    for (const run of runs) {
      // Chercher w:br dans chaque run
      const breaks = WordParser.findElementsByTag(run, 'w:br');
      
      for (const br of breaks) {
        // Vérifier si c'est un saut de page (w:type="page")
        if (br['$'] && br['$']['w:type'] === 'page') {
          return true;
        }
      }
      
      // Chercher aussi w:lastRenderedPageBreak (saut de page rendu par Word)
      const lastRenderedBreaks = WordParser.findElementsByTag(run, 'w:lastRenderedPageBreak');
      if (lastRenderedBreaks && lastRenderedBreaks.length > 0) {
        return true;
      }
    }
    
    return false;
  }
}

module.exports = ExtractParagraph;
