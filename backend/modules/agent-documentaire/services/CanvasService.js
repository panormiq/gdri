/**
 * Service Canvas - Gestion du canevas de styles
 * Fichier : backend/modules/agent-documentaire/services/CanvasService.js
 * 
 * Fonction : Gère la création, l'initialisation et la gestion du canevas de styles
 */

class CanvasService {
  /**
   * Crée un canevas par défaut en analysant les styles Word
   * @param {Object} jsonContent - Contenu JSON du document (avec styles Word)
   * @returns {Object} Canevas initialisé
   */
  static createDefaultCanvas(jsonContent) {
    // Analyser les styles Word pour proposer des valeurs par défaut
    const wordStyles = jsonContent.styles || {};
    const pageMargins = jsonContent.pageMargins || {
      top: 70.85,
      right: 70.85,
      bottom: 70.85,
      left: 70.85
    };

    // Analyser les styles de titres depuis les sections
    const titleStyles = this.analyzeTitleStyles(jsonContent.sections || []);
    
    // Analyser les styles de paragraphes
    const paragraphStyles = this.analyzeParagraphStyles(jsonContent.sections || []);

    return {
      titles: {
        level1: this.getDefaultTitleStyle(1, titleStyles.level1),
        level2: this.getDefaultTitleStyle(2, titleStyles.level2),
        level3: this.getDefaultTitleStyle(3, titleStyles.level3)
      },
      paragraphs: {
        default: this.getDefaultParagraphStyle(paragraphStyles)
      },
      images: {
        default: {
          maxWidth: "100%",
          marginTop: 12,
          marginBottom: 12,
          border: null,
          borderRadius: 0
        }
      },
      annexes: {
        default: {
          fontFamily: "Arial",
          fontSize: 12,
          fontWeight: "bold",
          color: "#000000",
          backgroundColor: null,
          marginTop: 12,
          marginBottom: null, // Pas de margin-bottom par défaut (évite les traits blancs)
          alignment: "left",
          textTransform: "none"
        }
      },
      pageMargins: pageMargins,
      locked: {
        pageMargins: false,
        titles: {
          level1: {},
          level2: {},
          level3: {}
        },
        paragraphs: {
          default: {}
        }
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      }
    };
  }

  /**
   * Analyse les styles de titres depuis les sections
   * @param {Array} sections - Sections du document
   * @returns {Object} Styles analysés par niveau
   */
  static analyzeTitleStyles(sections) {
    const stylesByLevel = { level1: [], level2: [], level3: [] };

    const traverse = (sectionList) => {
      if (!Array.isArray(sectionList)) return;

      sectionList.forEach(section => {
        if (section.titleStyles && section.level) {
          const level = Math.min(section.level, 3);
          stylesByLevel[`level${level}`].push(section.titleStyles);
        }

        if (section.children && section.children.length > 0) {
          traverse(section.children);
        }
      });
    };

    traverse(sections);

    // Calculer les valeurs moyennes/majoritaires pour chaque niveau
    return {
      level1: this.calculateAverageStyles(stylesByLevel.level1),
      level2: this.calculateAverageStyles(stylesByLevel.level2),
      level3: this.calculateAverageStyles(stylesByLevel.level3)
    };
  }

  /**
   * Analyse les styles de paragraphes depuis les sections
   * @param {Array} sections - Sections du document
   * @returns {Object} Styles analysés
   */
  static analyzeParagraphStyles(sections) {
    const paragraphStyles = [];

    const traverse = (sectionList) => {
      if (!Array.isArray(sectionList)) return;

      sectionList.forEach(section => {
        if (section.content && Array.isArray(section.content)) {
          section.content.forEach(item => {
            if (item.type === 'paragraph' && item.styles) {
              paragraphStyles.push(item.styles);
            }
          });
        }

        if (section.children && section.children.length > 0) {
          traverse(section.children);
        }
      });
    };

    traverse(sections);

    return this.calculateAverageStyles(paragraphStyles);
  }

  /**
   * Calcule les valeurs moyennes/majoritaires d'un ensemble de styles
   * @param {Array} stylesArray - Tableau de styles
   * @returns {Object} Styles calculés
   */
  static calculateAverageStyles(stylesArray) {
    if (!stylesArray || stylesArray.length === 0) {
      return {};
    }

    const result = {};

    // Propriétés numériques : moyenne
    const numericProps = ['fontSize'];
    numericProps.forEach(prop => {
      const values = stylesArray
        .map(s => s[prop])
        .filter(v => v !== null && v !== undefined && !isNaN(v));
      
      if (values.length > 0) {
        result[prop] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    });

    // Marges : extraire depuis spacing.before/after
    const marginTopValues = stylesArray
      .map(s => s.marginTop || (s.spacing && s.spacing.before ? s.spacing.before : null))
      .filter(v => v !== null && v !== undefined && !isNaN(v));
    if (marginTopValues.length > 0) {
      result.marginTop = marginTopValues.reduce((a, b) => a + b, 0) / marginTopValues.length;
    }

    // marginBottom : uniquement si la majorité des paragraphes en ont un significatif (> 3pt)
    // (évite d'appliquer un margin-bottom si la plupart n'en ont pas ou s'il est trop faible)
    const marginBottomValues = stylesArray
      .map(s => s.marginBottom || (s.spacing && s.spacing.after ? s.spacing.after : null))
      .filter(v => v !== null && v !== undefined && !isNaN(v) && v > 3); // Filtrer uniquement les valeurs > 3pt (significatives)
    
    // Ne mettre marginBottom que si au moins 60% des paragraphes en ont un significatif
    if (marginBottomValues.length > 0 && marginBottomValues.length >= stylesArray.length * 0.6) {
      const average = marginBottomValues.reduce((a, b) => a + b, 0) / marginBottomValues.length;
      // Ne mettre que si la moyenne est significative (> 3pt)
      result.marginBottom = average > 3 ? average : null;
    } else {
      // Si moins de 60% ont un marginBottom significatif, ne pas en mettre (évite les traits blancs)
      result.marginBottom = null;
    }

    // Line-height : extraire depuis spacing.line
    const lineHeightValues = stylesArray
      .map(s => {
        if (s.lineHeight) return s.lineHeight;
        if (s.spacing && s.spacing.line) return s.spacing.line;
        return null;
      })
      .filter(v => v !== null && v !== undefined && !isNaN(v));
    if (lineHeightValues.length > 0) {
      result.lineHeight = lineHeightValues.reduce((a, b) => a + b, 0) / lineHeightValues.length;
    }

    // Text-indent : extraire depuis indentation.firstLine
    const textIndentValues = stylesArray
      .map(s => s.textIndent || (s.indentation && s.indentation.firstLine ? s.indentation.firstLine : null))
      .filter(v => v !== null && v !== undefined && !isNaN(v));
    if (textIndentValues.length > 0) {
      result.textIndent = textIndentValues.reduce((a, b) => a + b, 0) / textIndentValues.length;
    }

    // Propriétés string : valeur la plus fréquente
    const stringProps = ['fontFamily', 'color', 'alignment', 'fontWeight'];
    stringProps.forEach(prop => {
      const values = stylesArray
        .map(s => {
          if (prop === 'fontWeight') {
            // Convertir bold en "bold"
            return s.bold ? 'bold' : (s[prop] || 'normal');
          }
          return s[prop];
        })
        .filter(v => v !== null && v !== undefined && v !== '');
      
      if (values.length > 0) {
        const frequency = {};
        values.forEach(v => {
          frequency[v] = (frequency[v] || 0) + 1;
        });
        result[prop] = Object.keys(frequency).reduce((a, b) => 
          frequency[a] > frequency[b] ? a : b
        );
      }
    });

    // Text-align : peut être dans alignment ou textAlign
    const textAlignValues = stylesArray
      .map(s => s.alignment || s.textAlign)
      .filter(v => v !== null && v !== undefined && v !== '');
    if (textAlignValues.length > 0) {
      const frequency = {};
      textAlignValues.forEach(v => {
        frequency[v] = (frequency[v] || 0) + 1;
      });
      result.textAlign = Object.keys(frequency).reduce((a, b) => 
        frequency[a] > frequency[b] ? a : b
      );
    }

    return result;
  }

  /**
   * Obtient un style de titre par défaut pour un niveau
   * @param {number} level - Niveau du titre (1, 2, 3)
   * @param {Object} analyzedStyle - Style analysé depuis Word
   * @returns {Object} Style de titre par défaut
   */
  static getDefaultTitleStyle(level, analyzedStyle = {}) {
    const defaults = {
      1: {
        fontFamily: "Arial",
        fontSize: 18,
        fontWeight: "bold",
        color: "#000000",
        backgroundColor: null,
        marginTop: 12,
        marginBottom: 6,
        alignment: "left",
        textTransform: "none"
      },
      2: {
        fontFamily: "Arial",
        fontSize: 16,
        fontWeight: "bold",
        color: "#000000",
        backgroundColor: null,
        marginTop: 10,
        marginBottom: 5,
        alignment: "left",
        textTransform: "none"
      },
      3: {
        fontFamily: "Arial",
        fontSize: 14,
        fontWeight: "bold",
        color: "#000000",
        backgroundColor: null,
        marginTop: 8,
        marginBottom: 4,
        alignment: "left",
        textTransform: "none"
      }
    };

    const defaultStyle = defaults[level] || defaults[3];
    
    // Fusionner avec les styles analysés (PRIORITÉ AUX STYLES WORD)
    return {
      fontFamily: analyzedStyle.fontFamily || defaultStyle.fontFamily,
      fontSize: analyzedStyle.fontSize || defaultStyle.fontSize,
      fontWeight: analyzedStyle.fontWeight || (analyzedStyle.bold ? "bold" : defaultStyle.fontWeight),
      color: analyzedStyle.color || defaultStyle.color,
      backgroundColor: null, // Pas de backgroundColor dans le canevas pour l'instant
      marginTop: analyzedStyle.marginTop !== undefined ? analyzedStyle.marginTop : defaultStyle.marginTop,
      marginBottom: analyzedStyle.marginBottom !== undefined ? analyzedStyle.marginBottom : defaultStyle.marginBottom,
      alignment: analyzedStyle.alignment || analyzedStyle.textAlign || defaultStyle.alignment,
      textTransform: analyzedStyle.textTransform || (analyzedStyle.caps ? "uppercase" : defaultStyle.textTransform)
    };
  }

  /**
   * Obtient un style de paragraphe par défaut
   * @param {Object} analyzedStyle - Style analysé depuis Word
   * @returns {Object} Style de paragraphe par défaut
   */
  static getDefaultParagraphStyle(analyzedStyle = {}) {
    const defaultStyle = {
      fontFamily: "Arial",
      fontSize: 11,
      lineHeight: 1.15,
      marginTop: 0,
      marginBottom: null, // Pas de margin-bottom par défaut (évite les traits blancs dans les surlignages)
      textAlign: "left",
      textIndent: 0
    };

    // PRIORITÉ AUX STYLES WORD ANALYSÉS
    // marginBottom : utiliser uniquement si Word en a défini un (> 0)
    let marginBottom = null;
    if (analyzedStyle.marginBottom !== undefined && analyzedStyle.marginBottom !== null && analyzedStyle.marginBottom > 0) {
      marginBottom = analyzedStyle.marginBottom;
    }

    return {
      fontFamily: analyzedStyle.fontFamily || defaultStyle.fontFamily,
      fontSize: analyzedStyle.fontSize !== undefined ? analyzedStyle.fontSize : defaultStyle.fontSize,
      lineHeight: analyzedStyle.lineHeight !== undefined ? analyzedStyle.lineHeight : defaultStyle.lineHeight,
      marginTop: analyzedStyle.marginTop !== undefined ? analyzedStyle.marginTop : defaultStyle.marginTop,
      marginBottom: marginBottom, // null si Word n'en a pas défini
      textAlign: analyzedStyle.textAlign || analyzedStyle.alignment || defaultStyle.textAlign,
      textIndent: analyzedStyle.textIndent !== undefined ? analyzedStyle.textIndent : defaultStyle.textIndent
    };
  }

  /**
   * Obtient un preset de canevas
   * @param {string} presetName - Nom du preset ("standard", "compact", "large")
   * @returns {Object} Canevas preset
   */
  static getPreset(presetName = "standard") {
    const presets = {
      standard: {
        titles: {
          level1: { fontFamily: "Arial", fontSize: 18, fontWeight: "bold", color: "#000000", marginTop: 12, marginBottom: 6, alignment: "left" },
          level2: { fontFamily: "Arial", fontSize: 16, fontWeight: "bold", color: "#000000", marginTop: 10, marginBottom: 5, alignment: "left" },
          level3: { fontFamily: "Arial", fontSize: 14, fontWeight: "bold", color: "#000000", marginTop: 8, marginBottom: 4, alignment: "left" }
        },
        paragraphs: {
          default: { fontFamily: "Arial", fontSize: 11, lineHeight: 1.15, marginTop: 0, marginBottom: null, textAlign: "left", textIndent: 0 }
        },
        pageMargins: { top: 70.85, right: 70.85, bottom: 70.85, left: 70.85 }
      },
      compact: {
        titles: {
          level1: { fontFamily: "Arial", fontSize: 16, fontWeight: "bold", color: "#000000", marginTop: 8, marginBottom: 4, alignment: "left" },
          level2: { fontFamily: "Arial", fontSize: 14, fontWeight: "bold", color: "#000000", marginTop: 6, marginBottom: 3, alignment: "left" },
          level3: { fontFamily: "Arial", fontSize: 12, fontWeight: "bold", color: "#000000", marginTop: 4, marginBottom: 2, alignment: "left" }
        },
        paragraphs: {
          default: { fontFamily: "Arial", fontSize: 10, lineHeight: 1.1, marginTop: 0, marginBottom: null, textAlign: "left", textIndent: 0 }
        },
        pageMargins: { top: 50, right: 50, bottom: 50, left: 50 }
      },
      large: {
        titles: {
          level1: { fontFamily: "Arial", fontSize: 20, fontWeight: "bold", color: "#000000", marginTop: 16, marginBottom: 8, alignment: "left" },
          level2: { fontFamily: "Arial", fontSize: 18, fontWeight: "bold", color: "#000000", marginTop: 14, marginBottom: 7, alignment: "left" },
          level3: { fontFamily: "Arial", fontSize: 16, fontWeight: "bold", color: "#000000", marginTop: 12, marginBottom: 6, alignment: "left" }
        },
        paragraphs: {
          default: { fontFamily: "Arial", fontSize: 12, lineHeight: 1.2, marginTop: 0, marginBottom: null, textAlign: "left", textIndent: 0 }
        },
        pageMargins: { top: 85, right: 85, bottom: 85, left: 85 }
      }
    };

    const preset = presets[presetName.toLowerCase()] || presets.standard;
    
    return {
      ...preset,
      images: {
        default: {
          maxWidth: "100%",
          marginTop: 12,
          marginBottom: 12,
          border: null,
          borderRadius: 0
        }
      },
      annexes: {
        default: {
          fontFamily: "Arial",
          fontSize: 12,
          fontWeight: "bold",
          color: "#000000",
          backgroundColor: null,
          marginTop: 12,
          marginBottom: null, // Pas de margin-bottom par défaut (évite les traits blancs)
          alignment: "left",
          textTransform: "none"
        }
      },
      locked: {
        pageMargins: false,
        titles: { level1: {}, level2: {}, level3: {} },
        paragraphs: { default: {} }
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      }
    };
  }
}

module.exports = CanvasService;

