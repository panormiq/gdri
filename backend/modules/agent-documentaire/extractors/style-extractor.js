/**
 * Style Extractor - Extraction des styles depuis styles.xml
 * Fichier : backend/modules/agent-documentaire/extractors/style-extractor.js
 * 
 * Fonction : Extrait et convertit les styles Word
 */

const xml2js = require('xml2js');

class StyleExtractor {
  /**
   * Extrait les styles depuis styles.xml
   * @param {string} stylesXml - Contenu XML de styles.xml
   * @returns {Promise<Object>} Objet contenant les styles extraits
   */
  static async extract(stylesXml) {
    if (!stylesXml) {
      console.log('⚠️  Fichier styles.xml non trouvé, utilisation des styles par défaut');
      return this.getDefaultStyles();
    }

    const parser = new xml2js.Parser({
      explicitArray: true,
      mergeAttrs: false,
      explicitRoot: false,
      attrkey: '$',
      charkey: '_'
    });

    try {
      const stylesObj = await parser.parseStringPromise(stylesXml);
      const styles = {};
      
      // Extraire les styles depuis w:style
      const styleElements = stylesObj['w:style'];
      if (styleElements && Array.isArray(styleElements)) {
        for (const styleElement of styleElements) {
          const style = this.extractStyle(styleElement);
          if (style && style.id) {
            styles[style.id] = style;
          }
        }
      }
      
      console.log(`✅ ${Object.keys(styles).length} styles extraits`);
      return styles;
    } catch (error) {
      console.error('❌ Erreur parsing styles.xml:', error.message);
      return this.getDefaultStyles();
    }
  }

  /**
   * Extrait un style individuel
   * @param {Object} styleElement - Élément w:style
   * @returns {Object} Style extrait
   */
  static extractStyle(styleElement) {
    const attrs = styleElement['$'] || {};
    const styleId = attrs['w:styleId'];
    const styleType = attrs['w:type'];
    
    if (!styleId) {
      return null;
    }

    const nameElement = styleElement['w:name'];
    const name = nameElement && nameElement[0] && nameElement[0]['$'] ? nameElement[0]['$']['w:val'] : styleId;

    const style = {
      id: styleId,
      name: name,
      type: styleType,
      next: null,
      basedOn: null
    };

    // Extraire basedOn
    const basedOnElement = styleElement['w:basedOn'];
    if (basedOnElement && basedOnElement[0] && basedOnElement[0]['$']) {
      style.basedOn = basedOnElement[0]['$']['w:val'];
    }

    // Extraire next
    const nextElement = styleElement['w:next'];
    if (nextElement && nextElement[0] && nextElement[0]['$']) {
      style.next = nextElement[0]['$']['w:val'];
    }

    // Extraire les propriétés de paragraphe si présentes
    if (styleType === 'paragraph') {
      const pPr = styleElement['w:pPr'];
      if (pPr && pPr[0]) {
        style.paragraph = this.extractParagraphPropertiesFromStyle(pPr[0]);
        
        // Extraire le numId depuis w:pPr > w:numPr > w:numId
        const numPr = pPr[0]['w:numPr'];
        if (numPr && numPr[0]) {
          const numId = numPr[0]['w:numId'];
          if (numId && numId[0] && numId[0]['$']) {
            style.numId = parseInt(numId[0]['$']['w:val']);
          }
        }
      } else {
        style.paragraph = {
          alignment: 'left',
          spacing: { before: 0, after: 0, line: 1.15 },
          indentation: { left: 0, right: 0, firstLine: 0 }
        };
      }
    }

    // Extraire les propriétés de run si présentes
    const rPr = styleElement['w:rPr'];
    if (rPr && rPr[0]) {
      style.run = this.extractRunPropertiesFromStyle(rPr[0]);
    } else if (styleType === 'paragraph') {
      style.run = {
        bold: false,
        italic: false,
        underline: false,
        fontSize: 12,
        fontFamily: 'Arial',
        color: '#000000',
        caps: false
      };
    }

    return style;
  }

  /**
   * Extrait les propriétés de paragraphe depuis un style
   */
  static extractParagraphPropertiesFromStyle(pPr) {
    const props = {
      alignment: 'left',
      spacing: { before: 0, after: 0, line: 1.15 },
      indentation: { left: 0, right: 0, firstLine: 0 },
      backgroundColor: null
    };

    // Alignement
    const jc = pPr['w:jc'];
    if (jc && jc[0] && jc[0]['$']) {
      const val = jc[0]['$']['w:val'];
      props.alignment = val === 'both' ? 'justify' : (val || 'left');
    }

    // Espacement
    const spacing = pPr['w:spacing'];
    if (spacing && spacing[0] && spacing[0]['$']) {
      const s = spacing[0]['$'];
      if (s['w:before']) props.spacing.before = this.twipsToPoints(parseInt(s['w:before']) || 0);
      if (s['w:after']) props.spacing.after = this.twipsToPoints(parseInt(s['w:after']) || 0);
      if (s['w:line']) {
        const lineValue = s['w:line'];
        const lineRule = s['w:lineRule']; // "auto", "exact", "atLeast"
        
        if (lineValue === 'auto') {
          props.spacing.line = 1.15;
          props.spacing.lineType = 'multiple';
        } else if (lineRule === 'exact' || lineRule === 'atLeast') {
          // Valeur fixe en twips (1/20 de point)
          const lineInTwips = parseInt(lineValue) || 0;
          props.spacing.line = this.twipsToPoints(lineInTwips);
          props.spacing.lineType = 'fixed';
        } else {
          // Multiple en 240èmes de ligne
          props.spacing.line = parseInt(lineValue) / 240;
          props.spacing.lineType = 'multiple';
        }
      }
    }

    // Indentation
    const ind = pPr['w:ind'];
    if (ind && ind[0] && ind[0]['$']) {
      const i = ind[0]['$'];
      if (i['w:left']) props.indentation.left = this.twipsToPoints(parseInt(i['w:left']) || 0);
      if (i['w:right']) props.indentation.right = this.twipsToPoints(parseInt(i['w:right']) || 0);
      if (i['w:firstLine']) props.indentation.firstLine = this.twipsToPoints(parseInt(i['w:firstLine']) || 0);
      if (i['w:hanging']) props.indentation.firstLine = -this.twipsToPoints(parseInt(i['w:hanging']) || 0);
    }

    // Couleur de fond du paragraphe (w:shd)
    const shd = pPr['w:shd'];
    if (shd && shd[0] && shd[0]['$']) {
      const fill = shd[0]['$']['w:fill'];
      if (fill && fill !== 'auto') {
        props.backgroundColor = `#${fill}`;
      }
    }

    return props;
  }

  /**
   * Extrait les propriétés de run depuis un style
   */
  static extractRunPropertiesFromStyle(rPr) {
    const props = {
      bold: false,
      italic: false,
      underline: false,
      fontSize: 12,
      fontFamily: 'Arial',
      color: '#000000',
      caps: false,
      runBackgroundColor: null
    };

    // Gras
    if (rPr['w:b']) props.bold = true;
    
    // Italique
    if (rPr['w:i']) props.italic = true;
    
    // Souligné
    if (rPr['w:u']) props.underline = true;
    
    // Majuscules
    if (rPr['w:caps']) props.caps = true;

    // Taille de police
    const sz = rPr['w:sz'];
    if (sz && sz[0] && sz[0]['$']) {
      props.fontSize = this.halfPointsToPoints(parseInt(sz[0]['$']['w:val']) || 24);
    }

    // Famille de police
    const rFonts = rPr['w:rFonts'];
    if (rFonts && rFonts[0] && rFonts[0]['$']) {
      props.fontFamily = rFonts[0]['$']['w:ascii'] || rFonts[0]['$']['w:hAnsi'] || 'Arial';
    }

    // Couleur
    const color = rPr['w:color'];
    if (color && color[0] && color[0]['$']) {
      const colorVal = color[0]['$']['w:val'];
      if (colorVal && colorVal !== 'auto') {
        props.color = `#${colorVal}`;
      }
    }

    // Couleur de fond du run (w:shd)
    const shd = rPr['w:shd'];
    if (shd && shd[0] && shd[0]['$']) {
      const fill = shd[0]['$']['w:fill'];
      if (fill && fill !== 'auto') {
        props.runBackgroundColor = `#${fill}`;
      }
    }

    return props;
  }

  /**
   * Retourne les styles par défaut
   */
  static getDefaultStyles() {
    return {
      'Normal': {
        id: 'Normal',
        name: 'Normal',
        type: 'paragraph',
        next: null,
        basedOn: null,
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
          caps: false,
          runBackgroundColor: null
        }
      }
    };
  }

  /**
   * Convertit des twips en points
   * 1 twip = 1/20 point
   * @param {number} twips - Valeur en twips
   * @returns {number} Valeur en points
   */
  static twipsToPoints(twips) {
    return twips / 20;
  }

  /**
   * Convertit des points en twips
   * @param {number} points - Valeur en points
   * @returns {number} Valeur en twips
   */
  static pointsToTwips(points) {
    return points * 20;
  }

  /**
   * Convertit des EMU (English Metric Units) en points
   * 1 EMU = 1/914400 inch = 1/12700 point
   * @param {number} emu - Valeur en EMU
   * @returns {number} Valeur en points
   */
  static emuToPoints(emu) {
    return emu / 12700;
  }

  /**
   * Convertit des demi-points en points
   * Word utilise des demi-points pour certaines valeurs (fontSize)
   * @param {number} halfPoints - Valeur en demi-points
   * @returns {number} Valeur en points
   */
  static halfPointsToPoints(halfPoints) {
    return halfPoints / 2;
  }
}

module.exports = StyleExtractor;

