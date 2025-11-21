/**
 * Parser Word - Utilitaire pour parcourir le XML Word
 * Fichier : backend/modules/agent-documentaire/extractors/word-parser.js
 * 
 * Fonction : Fournit des fonctions utilitaires pour parser et parcourir
 * la structure XML d'un document Word de manière structurée
 */

const { getTagConfig } = require('./word-tags-config');

class WordParser {
  /**
   * Structure d'un document Word après parsing xml2js :
   * 
   * documentObj = {
   *   "w:document": {
   *     "w:body": [{
   *       "w:p": [...],      // Paragraphes
   *       "w:tbl": [...],    // Tableaux
   *       "w:sectPr": [...]  // Propriétés de section
   *     }]
   *   }
   * }
   * 
   * OU (si explicitRoot: false) :
   * 
   * documentObj = {
   *   "w:body": [{
   *     "w:p": [...],
   *     "w:tbl": [...]
   *   }]
   * }
   */

  /**
   * Récupère le corps du document (w:body)
   * @param {Object} documentObj - Objet XML parsé
   * @returns {Array|null} Tableau des éléments du corps ou null
   */
  static getBody(documentObj) {
    // Si explicitRoot: false, w:body est directement accessible
    if (documentObj['w:body']) {
      return documentObj['w:body'][0];
    }
    
    // Sinon, chercher dans w:document
    if (documentObj['w:document']?.[0]?.['w:body']) {
      return documentObj['w:document'][0]['w:body'][0];
    }
    
    return null;
  }

  /**
   * Parcourt récursivement un élément XML et retourne tous les éléments enfants
   * @param {Object} element - Élément XML
   * @returns {Array} Liste des éléments enfants (balises + contenu)
   */
  static getChildElements(element) {
    if (!element || typeof element !== 'object') {
      return [];
    }

    const children = [];
    
    // Parcourir toutes les propriétés de l'élément
    for (const [key, value] of Object.entries(element)) {
      // Ignorer les attributs spéciaux de xml2js ($ = attributs)
      if (key === '$') {
        continue;
      }
      
      // Si la valeur est un tableau, traiter chaque élément
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            children.push({ tag: key, element: item });
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        children.push({ tag: key, element: value });
      }
    }
    
    return children;
  }

  /**
   * Identifie le type d'un élément XML en utilisant word-tags-config
   * @param {string} tagName - Nom de la balise (ex: "w:p", "w:r")
   * @param {Object} element - Élément XML complet
   * @returns {Object|null} Configuration de la balise ou null
   */
  static identifyElement(tagName, element) {
    return getTagConfig(tagName, element);
  }

  /**
   * Parcourt le corps du document et retourne tous les éléments de premier niveau
   * (paragraphes, tableaux, etc.)
   * @param {Object} documentObj - Objet XML parsé
   * @returns {Array} Liste des éléments de premier niveau
   */
  static getTopLevelElements(documentObj) {
    const body = this.getBody(documentObj);
    if (!body) {
      return [];
    }

    const elements = [];
    
    // Le body est un objet avec des propriétés comme w:p, w:tbl, etc.
    for (const [tagName, tagValue] of Object.entries(body)) {
      // Ignorer les attributs spéciaux
      if (tagName === '$') {
        continue;
      }
      
      // Si c'est un tableau, traiter chaque élément
      if (Array.isArray(tagValue)) {
        for (const item of tagValue) {
          if (typeof item === 'object' && item !== null) {
            elements.push({
              tag: tagName,
              element: item,
              config: this.identifyElement(tagName, item)
            });
          }
        }
      } else if (typeof tagValue === 'object' && tagValue !== null) {
        elements.push({
          tag: tagName,
          element: tagValue,
          config: this.identifyElement(tagName, tagValue)
        });
      }
    }
    
    return elements;
  }

  /**
   * Vérifie si un élément contient xml:space="preserve" quelque part
   * @param {Object} element - Élément XML à vérifier
   * @returns {boolean} True si xml:space="preserve" est trouvé
   */
  static hasXmlSpacePreserve(element) {
    if (!element || typeof element !== 'object') {
      return false;
    }
    
    // Vérifier l'élément actuel
    if (element['$'] && element['$']['xml:space'] === 'preserve') {
      return true;
    }
    
    // Vérifier récursivement tous les enfants
    for (const [key, value] of Object.entries(element)) {
      if (key === '$') continue;
      
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'object' && this.hasXmlSpacePreserve(item)) {
            return true;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        if (this.hasXmlSpacePreserve(value)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Extrait le texte brut d'un élément (pour debug/affichage)
   * @param {Object} element - Élément XML
   * @param {number} maxDepth - Profondeur maximale de récursion
   * @returns {string} Texte extrait
   */
  static extractText(element, maxDepth = 10, preserveSpaces = false) {
    if (maxDepth <= 0 || !element || typeof element !== 'object') {
      return '';
    }

    // Si c'est le premier appel, vérifier si l'élément contient xml:space="preserve"
    const hasPreserve = !preserveSpaces && this.hasXmlSpacePreserve(element);
    
    let text = '';
    let foundPreserveSpace = hasPreserve; // Tracker si on trouve xml:space="preserve" quelque part
    
    for (const [key, value] of Object.entries(element)) {
      if (key === '$') {
        continue;
      }
      
      // Si c'est w:t (texte), extraire directement
      if (key === 'w:t') {
        if (Array.isArray(value)) {
          value.forEach(v => {
            if (typeof v === 'string') {
              text += v;
            } else if (typeof v === 'object' && v['_']) {
              // Vérifier xml:space="preserve"
              if (v['$'] && v['$']['xml:space'] === 'preserve') {
                foundPreserveSpace = true;
              }
              text += v['_'];
            }
          });
        } else if (typeof value === 'string') {
          text += value;
        } else if (typeof value === 'object' && value['_']) {
          // Vérifier xml:space="preserve" sur l'élément w:t
          if (value['$'] && value['$']['xml:space'] === 'preserve') {
            foundPreserveSpace = true;
          }
          text += value['_'];
        }
      } else if (Array.isArray(value)) {
        // Parcourir récursivement
        for (const item of value) {
          if (typeof item === 'object') {
            text += this.extractText(item, maxDepth - 1, true);
          } else if (typeof item === 'string') {
            text += item;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        text += this.extractText(value, maxDepth - 1, true);
      } else if (typeof value === 'string') {
        text += value;
      }
    }
    
    // Ne JAMAIS trim() si preserveSpaces=true (appels récursifs)
    // Trim() uniquement au niveau racine ET si aucun preserve trouvé
    const shouldTrim = !preserveSpaces && !foundPreserveSpace;
    
    return shouldTrim ? text.trim() : text;
  }

  /**
   * Vérifie si un paragraphe a un style spécifique (ex: Heading1)
   * @param {Object} paragraphElement - Élément w:p
   * @param {string} styleName - Nom du style à chercher (ex: "Heading1")
   * @returns {boolean} True si le paragraphe a ce style
   */
  static hasParagraphStyle(paragraphElement, styleName) {
    if (!paragraphElement || typeof paragraphElement !== 'object') {
      return false;
    }

    // Chercher w:pPr > w:pStyle > w:val
    const pPr = paragraphElement['w:pPr'];
    if (!pPr) {
      return false;
    }

    // pPr peut être un tableau ou un objet
    const pPrArray = Array.isArray(pPr) ? pPr : [pPr];
    
    for (const pPrItem of pPrArray) {
      const pStyle = pPrItem['w:pStyle'];
      if (pStyle) {
        const pStyleArray = Array.isArray(pStyle) ? pStyle : [pStyle];
        for (const styleItem of pStyleArray) {
          const val = styleItem['$']?.['w:val'];
          if (val === styleName) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Récupère le style d'un paragraphe
   * @param {Object} paragraphElement - Élément w:p
   * @returns {string|null} Nom du style ou null
   */
  static getParagraphStyle(paragraphElement) {
    if (!paragraphElement || typeof paragraphElement !== 'object') {
      return null;
    }

    const pPr = paragraphElement['w:pPr'];
    if (!pPr) {
      return null;
    }

    const pPrArray = Array.isArray(pPr) ? pPr : [pPr];
    
    for (const pPrItem of pPrArray) {
      const pStyle = pPrItem['w:pStyle'];
      if (pStyle) {
        const pStyleArray = Array.isArray(pStyle) ? pStyle : [pStyle];
        for (const styleItem of pStyleArray) {
          const val = styleItem['$']?.['w:val'];
          if (val) {
            return val;
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Parcourt un élément et trouve tous les éléments d'un type donné
   * @param {Object} element - Élément XML à parcourir
   * @param {string} tagName - Nom de la balise à chercher (ex: "w:r", "w:t")
   * @returns {Array} Liste des éléments trouvés
   */
  static findElementsByTag(element, tagName) {
    const results = [];
    
    if (!element || typeof element !== 'object') {
      return results;
    }

    // Parcourir récursivement
    for (const [key, value] of Object.entries(element)) {
      if (key === '$') {
        continue;
      }
      
      if (key === tagName) {
        if (Array.isArray(value)) {
          results.push(...value);
        } else {
          results.push(value);
        }
      }
      
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            results.push(...this.findElementsByTag(item, tagName));
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        results.push(...this.findElementsByTag(value, tagName));
      }
    }
    
    return results;
  }
}

module.exports = WordParser;

