/**
 * Extracteur de styles Word
 * Fichier : backend/modules/agent-documentaire/extractors/style-extractor.js
 * 
 * Fonction : Extrait les styles généraux du document Word depuis word/styles.xml
 * Ces styles sont ensuite utilisés comme base pour tous les éléments du document
 */

const xml2js = require('xml2js');

class StyleExtractor {
  /**
   * Extrait les styles depuis word/styles.xml
   * @param {string} stylesXml - Contenu XML de word/styles.xml
   * @returns {Promise<Object>} Objet avec tous les styles indexés par leur ID
   */
  static async extract(stylesXml) {
    if (!stylesXml) {
      console.warn('⚠️  word/styles.xml non trouvé, utilisation des styles par défaut');
      return this.getDefaultStyles();
    }

    const parser = new xml2js.Parser({
      explicitArray: true,
      mergeAttrs: false,
      explicitRoot: false,
      trim: true,
      normalize: true,
      charkey: '_',
      attrkey: '$'
    });

    const stylesObj = await parser.parseStringPromise(stylesXml);
    const styles = {};

    // Structure de word/styles.xml :
    // {
    //   "w:styles": {
    //     "w:style": [
    //       {
    //         "$": { "w:type": "paragraph", "w:styleId": "Heading1" },
    //         "w:name": [{ "$": { "w:val": "heading 1" } }],
    //         "w:pPr": [...],  // Propriétés de paragraphe
    //         "w:rPr": [...]   // Propriétés de run (formatage)
    //       }
    //     ]
    //   }
    // }

    // Les styles peuvent être directement dans w:style ou dans w:styles[0]['w:style']
    let styleArray = [];
    if (stylesObj['w:style']) {
      // Styles directement à la racine
      styleArray = Array.isArray(stylesObj['w:style']) ? stylesObj['w:style'] : [stylesObj['w:style']];
    } else if (stylesObj['w:styles']) {
      // Styles dans w:styles wrapper
      const stylesElement = Array.isArray(stylesObj['w:styles']) ? stylesObj['w:styles'][0] : stylesObj['w:styles'];
      styleArray = stylesElement?.['w:style'] || [];
      if (!Array.isArray(styleArray)) {
        styleArray = [styleArray];
      }
    }
    
    if (styleArray.length === 0) {
      return this.getDefaultStyles();
    }
    
    for (const style of styleArray) {
      const attrs = style['$'] || {};
      const styleId = attrs['w:styleId'];
      const styleType = attrs['w:type']; // paragraph, character, table, etc.

      if (!styleId) {
        continue;
      }

      // Extraire le nom du style
      const nameElement = style['w:name'];
      const styleName = nameElement?.[0]?.['$']?.['w:val'] || styleId;

      // Extraire les propriétés de hiérarchie (w:next, w:basedOn)
      const nextElement = style['w:next'];
      const nextStyle = nextElement?.[0]?.['$']?.['w:val'] || null;
      
      const basedOnElement = style['w:basedOn'];
      const basedOnStyle = basedOnElement?.[0]?.['$']?.['w:val'] || null;

      // Extraire les propriétés de paragraphe (w:pPr)
      const pPr = style['w:pPr']?.[0] || {};
      const paragraphProps = this.extractParagraphProperties(pPr);

      // Extraire les propriétés de run (w:rPr)
      const rPr = style['w:rPr']?.[0] || {};
      const runProps = this.extractRunProperties(rPr);

      // Stocker le style avec les informations de hiérarchie
      styles[styleId] = {
        id: styleId,
        name: styleName,
        type: styleType,
        next: nextStyle,        // Style suivant dans la hiérarchie
        basedOn: basedOnStyle,  // Style de base
        paragraph: paragraphProps,
        run: runProps
      };
    }

    console.log(`✅ ${Object.keys(styles).length} styles extraits`);
    return styles;
  }

  /**
   * Extrait les propriétés de paragraphe depuis w:pPr
   * @param {Object} pPr - Élément w:pPr
   * @returns {Object} Propriétés de paragraphe
   */
  static extractParagraphProperties(pPr) {
    const props = {
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
    };

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
        props.spacing.before = this.twipsToPoints(parseInt(spacing['w:before']) || 0);
      }
      if (spacing['w:after']) {
        props.spacing.after = this.twipsToPoints(parseInt(spacing['w:after']) || 0);
      }
      if (spacing['w:line']) {
        // w:line peut être un nombre (en 240èmes) ou "auto"
        const lineValue = spacing['w:line'];
        if (lineValue === 'auto') {
          props.spacing.line = 1.15; // Par défaut
        } else {
          props.spacing.line = parseInt(lineValue) / 240;
        }
      }
    }

    // Indentation (w:ind)
    const ind = pPr['w:ind']?.[0]?.['$'];
    if (ind) {
      if (ind['w:left']) {
        props.indentation.left = this.twipsToPoints(parseInt(ind['w:left']) || 0);
      }
      if (ind['w:right']) {
        props.indentation.right = this.twipsToPoints(parseInt(ind['w:right']) || 0);
      }
      if (ind['w:firstLine']) {
        props.indentation.firstLine = this.twipsToPoints(parseInt(ind['w:firstLine']) || 0);
      }
      if (ind['w:hanging']) {
        // Indentation négative (retrait)
        props.indentation.firstLine = -this.twipsToPoints(parseInt(ind['w:hanging']) || 0);
      }
    }

    return props;
  }

  /**
   * Extrait les propriétés de run (formatage) depuis w:rPr
   * @param {Object} rPr - Élément w:rPr
   * @returns {Object} Propriétés de run
   */
  static extractRunProperties(rPr) {
    const props = {
      bold: false,
      italic: false,
      underline: false,
      fontSize: 12,
      fontFamily: 'Arial',
      color: '#000000',
      caps: false
    };

    // Gras (w:b)
    if (rPr['w:b'] && rPr['w:b'].length > 0) {
      const bVal = rPr['w:b'][0]['$']?.['w:val'];
      props.bold = bVal !== 'false' && bVal !== '0' && bVal !== false;
    }

    // Italique (w:i)
    if (rPr['w:i'] && rPr['w:i'].length > 0) {
      const iVal = rPr['w:i'][0]['$']?.['w:val'];
      props.italic = iVal !== 'false' && iVal !== '0' && iVal !== false;
    }

    // Souligné (w:u)
    if (rPr['w:u'] && rPr['w:u'].length > 0) {
      const uVal = rPr['w:u'][0]['$']?.['w:val'];
      props.underline = uVal && uVal !== 'none' && uVal !== 'false';
    }

    // Taille de police (w:sz)
    const sz = rPr['w:sz']?.[0]?.['$']?.['w:val'];
    if (sz) {
      // w:sz est en demi-points (ex: 24 = 12pt)
      props.fontSize = parseInt(sz) / 2;
    }

    // Police (w:rFonts)
    const rFonts = rPr['w:rFonts']?.[0]?.['$'];
    if (rFonts) {
      // w:ascii, w:hAnsi, w:eastAsia, w:cs
      props.fontFamily = rFonts['w:ascii'] || rFonts['w:hAnsi'] || 'Arial';
    }

    // Couleur (w:color)
    const color = rPr['w:color']?.[0]?.['$'];
    if (color && color['w:val']) {
      const colorVal = color['w:val'];
      // Word utilise des codes hexadécimaux sans #
      if (colorVal.length === 6) {
        props.color = `#${colorVal}`;
      } else if (colorVal.startsWith('#')) {
        props.color = colorVal;
      }
    }

    // Majuscules (w:caps)
    if (rPr['w:caps'] && rPr['w:caps'].length > 0) {
      const capsVal = rPr['w:caps'][0]['$']?.['w:val'];
      props.caps = capsVal !== 'false' && capsVal !== '0' && capsVal !== false;
    }

    return props;
  }

  /**
   * Convertit des twips en points
   * 1 twip = 1/20 point = 1/1440 inch
   * @param {number} twips - Valeur en twips
   * @returns {number} Valeur en points
   */
  static twipsToPoints(twips) {
    return twips / 20;
  }

  /**
   * Retourne les styles par défaut si word/styles.xml n'est pas disponible
   * @returns {Object} Styles par défaut
   */
  static getDefaultStyles() {
    return {
      'Normal': {
        id: 'Normal',
        name: 'Normal',
        type: 'paragraph',
        paragraph: {
          alignment: 'left',
          spacing: { before: 0, after: 0, line: 1.15 },
          indentation: { left: 0, right: 0, firstLine: 0 }
        },
        run: {
          bold: false,
          italic: false,
          underline: false,
          fontSize: 12,
          fontFamily: 'Arial',
          color: '#000000',
          caps: false
        }
      },
      'Heading1': {
        id: 'Heading1',
        name: 'heading 1',
        type: 'paragraph',
        paragraph: {
          alignment: 'left',
          spacing: { before: 12, after: 6, line: 1.15 },
          indentation: { left: 0, right: 0, firstLine: 0 }
        },
        run: {
          bold: true,
          italic: false,
          underline: false,
          fontSize: 16,
          fontFamily: 'Arial',
          color: '#000000',
          caps: false
        }
      },
      'Heading2': {
        id: 'Heading2',
        name: 'heading 2',
        type: 'paragraph',
        paragraph: {
          alignment: 'left',
          spacing: { before: 10, after: 4, line: 1.15 },
          indentation: { left: 0, right: 0, firstLine: 0 }
        },
        run: {
          bold: true,
          italic: false,
          underline: false,
          fontSize: 14,
          fontFamily: 'Arial',
          color: '#000000',
          caps: false
        }
      }
    };
  }

  /**
   * Fusionne un style général avec des propriétés inline
   * Les propriétés inline prennent le dessus sur le style général
   * @param {Object} baseStyle - Style de base (depuis styles.xml)
   * @param {Object} inlineProps - Propriétés inline (depuis w:pPr ou w:rPr)
   * @returns {Object} Style fusionné
   */
  static mergeStyle(baseStyle, inlineProps) {
    return {
      ...baseStyle,
      ...inlineProps,
      // Fusionner les objets imbriqués
      spacing: {
        ...(baseStyle.spacing || {}),
        ...(inlineProps.spacing || {})
      },
      indentation: {
        ...(baseStyle.indentation || {}),
        ...(inlineProps.indentation || {})
      }
    };
  }
}

module.exports = StyleExtractor;

