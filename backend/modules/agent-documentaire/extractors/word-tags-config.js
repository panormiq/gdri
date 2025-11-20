/**
 * Configuration des balises Word et leurs méthodes d'extraction
 * Fichier : backend/modules/agent-documentaire/extractors/word-tags-config.js
 * 
 * Fonction : Définit toutes les balises Word que l'on sait traiter
 * et leur méthode d'extraction associée
 * 
 * Structure :
 * - tagName : Nom de la balise XML Word (ex: "w:p", "w:r", "w:t")
 * - type : Type d'élément dans notre JSON (ex: "paragraph", "heading", "image")
 * - method : Nom de la méthode d'extraction à utiliser
 * - properties : Propriétés à extraire depuis la balise
 * - required : Si la balise est requise pour le type
 */

// Import des méthodes d'extraction - LAZY LOADING pour éviter les dépendances circulaires
// On ne charge pas les modules ici, mais on les charge à la demande dans getTagConfig
let extractParagraph = null;
let extractHeading = null;
let extractImage = null;
let extractTable = null;

function getExtractParagraph() {
  if (!extractParagraph) {
    extractParagraph = require('./methodes/extract-paragraph');
  }
  return extractParagraph;
}

function getExtractHeading() {
  if (!extractHeading) {
    extractHeading = require('./methodes/extract-heading');
  }
  return extractHeading;
}

function getExtractImage() {
  if (!extractImage) {
    extractImage = require('./methodes/extract-image');
  }
  return extractImage;
}

function getExtractTable() {
  if (!extractTable) {
    extractTable = require('./methodes/extract-table');
  }
  return extractTable;
}

/**
 * Configuration des balises Word supportées
 * 
 * Structure d'une entrée :
 * {
 *   tag: "w:p",                    // Nom de la balise XML
 *   type: "paragraph",              // Type dans notre JSON
 *   method: extractParagraph.extract, // Méthode d'extraction
 *   properties: ["text", "styles"], // Propriétés à extraire
 *   conditions: {                   // Conditions pour utiliser cette balise
 *     hasStyle: "Heading1"          // Ex: seulement si w:pStyle = "Heading1"
 *   }
 * }
 */
const wordTagsConfig = {
  // ==========================================
  // PARAGRAPHES
  // ==========================================
  paragraph: {
    tag: 'w:p',
    type: 'paragraph',
    method: null, // Chargé à la demande
    getMethod: () => getExtractParagraph().extract,
    properties: [
      'text',           // Texte du paragraphe
      'styles',         // Styles (gras, italique, etc.)
      'alignment',      // Alignement (left, center, right, justify)
      'spacing',        // Interlignes et marges
      'indentation'     // Indentation gauche/droite
    ],
    required: false
  },

  // ==========================================
  // TITRES / HEADINGS
  // ==========================================
  heading1: {
    tag: 'w:p',
    type: 'heading',
    method: null, // Chargé à la demande
    getMethod: () => getExtractHeading().extract,
    properties: [
      'text',
      'level',          // Niveau du titre (1-9)
      'styles',
      'alignment'
    ],
    conditions: {
      hasStyle: 'Heading1'  // w:pStyle avec valeur "Heading1"
    },
    required: false
  },
  heading2: {
    tag: 'w:p',
    type: 'heading',
    method: null, // Chargé à la demande
    getMethod: () => getExtractHeading().extract,
    properties: [
      'text',
      'level',
      'styles',
      'alignment'
    ],
    conditions: {
      hasStyle: 'Heading2'
    },
    required: false
  },
  heading3: {
    tag: 'w:p',
    type: 'heading',
    method: null, // Chargé à la demande
    getMethod: () => getExtractHeading().extract,
    properties: [
      'text',
      'level',
      'styles',
      'alignment'
    ],
    conditions: {
      hasStyle: 'Heading3'
    },
    required: false
  },
  heading4: {
    tag: 'w:p',
    type: 'heading',
    method: null, // Chargé à la demande
    getMethod: () => getExtractHeading().extract,
    properties: [
      'text',
      'level',
      'styles',
      'alignment'
    ],
    conditions: {
      hasStyle: 'Heading4'
    },
    required: false
  },
  heading5: {
    tag: 'w:p',
    type: 'heading',
    method: null, // Chargé à la demande
    getMethod: () => getExtractHeading().extract,
    properties: [
      'text',
      'level',
      'styles',
      'alignment'
    ],
    conditions: {
      hasStyle: 'Heading5'
    },
    required: false
  },
  heading6: {
    tag: 'w:p',
    type: 'heading',
    method: null, // Chargé à la demande
    getMethod: () => getExtractHeading().extract,
    properties: [
      'text',
      'level',
      'styles',
      'alignment'
    ],
    conditions: {
      hasStyle: 'Heading6'
    },
    required: false
  },

  // ==========================================
  // IMAGES
  // ==========================================
  imageInline: {
    tag: 'w:drawing',
    type: 'image',
    method: null, // Chargé à la demande
    getMethod: () => getExtractImage().extract,
    properties: [
      'src',            // Chemin vers l'image
      'width',          // Largeur
      'height',         // Hauteur
      'position',       // Position (x, y) si anchor
      'rotation',      // Rotation
      'crop'            // Rognage
    ],
    conditions: {
      hasType: 'inline'  // Image inline (dans le texte)
    },
    required: false
  },
  imageAnchor: {
    tag: 'wp:anchor',
    type: 'image',
    method: null, // Chargé à la demande
    getMethod: () => getExtractImage().extract,
    properties: [
      'src',
      'width',
      'height',
      'position',       // Position absolute (x, y)
      'rotation',
      'crop'
    ],
    conditions: {
      hasType: 'anchor'  // Image anchor (position absolute)
    },
    required: false
  },

  // ==========================================
  // TABLEAUX
  // ==========================================
  table: {
    tag: 'w:tbl',
    type: 'table',
    method: null, // Chargé à la demande
    getMethod: () => getExtractTable().extract,
    properties: [
      'rows',           // Nombre de lignes
      'columns',        // Nombre de colonnes
      'cells',          // Contenu des cellules
      'styles',         // Styles (bordures, couleurs)
      'headerRow'       // Ligne d'en-tête
    ],
    required: false
  },
  tableRow: {
    tag: 'w:tr',
    type: 'tableRow',
    method: null,  // Traité dans extract-table.js
    properties: [
      'cells'
    ],
    required: false
  },
  tableCell: {
    tag: 'w:tc',
    type: 'tableCell',
    method: null,  // Traité dans extract-table.js
    properties: [
      'content',
      'styles'
    ],
    required: false
  },

  // ==========================================
  // BALISES DE FORMATAGE (dans les paragraphes)
  // ==========================================
  run: {
    tag: 'w:r',
    type: 'textRun',
    method: null,  // Traité dans extract-paragraph.js
    properties: [
      'text',
      'styles'         // Gras, italique, souligné, couleur, etc.
    ],
    required: false
  },
  text: {
    tag: 'w:t',
    type: 'text',
    method: null,  // Traité dans extract-paragraph.js
    properties: [
      'content'         // Contenu textuel
    ],
    required: false
  },
  break: {
    tag: 'w:br',
    type: 'break',
    method: null,  // Traité dans extract-paragraph.js
    properties: [
      'type'            // Type de saut de ligne
    ],
    required: false
  },

  // ==========================================
  // PROPRIÉTÉS DE PARAGRAPHE
  // ==========================================
  paragraphProperties: {
    tag: 'w:pPr',
    type: 'paragraphProperties',
    method: null,  // Traité dans extract-paragraph.js
    properties: [
      'alignment',      // w:jc (justification)
      'spacing',        // w:spacing (interlignes)
      'indentation',    // w:ind (marges)
      'style'           // w:pStyle (style du paragraphe)
    ],
    required: false
  },
  runProperties: {
    tag: 'w:rPr',
    type: 'runProperties',
    method: null,  // Traité dans extract-paragraph.js
    properties: [
      'bold',           // w:b
      'italic',        // w:i
      'underline',     // w:u
      'color',         // w:color
      'fontSize',      // w:sz
      'fontFamily',    // w:rFonts
      'caps'           // w:caps (majuscules)
    ],
    required: false
  }
};

/**
 * Retourne la configuration pour une balise donnée
 * @param {string} tagName - Nom de la balise XML (ex: "w:p", "w:r")
 * @param {Object} element - Élément XML à analyser (pour vérifier les conditions)
 * @returns {Object|null} Configuration de la balise ou null
 */
function getTagConfig(tagName, element = null) {
  // Chercher dans toutes les configurations
  for (const [key, config] of Object.entries(wordTagsConfig)) {
    if (config.tag === tagName) {
      // Vérifier les conditions si présentes
      if (config.conditions && element) {
        // Vérifier hasStyle
        if (config.conditions.hasStyle) {
          const pStyle = element['w:pPr']?.[0]?.['w:pStyle']?.[0]?.['$']?.['w:val'];
          if (pStyle === config.conditions.hasStyle) {
            return config;
          }
        }
        // Vérifier hasType
        if (config.conditions.hasType) {
          // Logique pour vérifier le type (inline vs anchor)
          // À implémenter selon la structure XML
        }
      } else {
        return config;
      }
    }
  }
  return null;
}

/**
 * Retourne toutes les configurations d'un type donné
 * @param {string} type - Type d'élément (ex: "paragraph", "heading", "image")
 * @returns {Array} Liste des configurations
 */
function getConfigsByType(type) {
  return Object.values(wordTagsConfig).filter(config => config.type === type);
}

/**
 * Retourne toutes les balises supportées
 * @returns {Array} Liste des noms de balises
 */
function getSupportedTags() {
  return [...new Set(Object.values(wordTagsConfig).map(config => config.tag))];
}

module.exports = {
  wordTagsConfig,
  getTagConfig,
  getConfigsByType,
  getSupportedTags
};

