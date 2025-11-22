/**
 * Génération : Paragraphe
 * Fichier : backend/modules/agent-documentaire/generators/methodes/generate-paragraph.js
 * 
 * Fonction : Génère le HTML pour un paragraphe avec styles
 */

class GenerateParagraph {
  /**
   * Génère le HTML pour un paragraphe
   * @param {Object} paragraph - Objet paragraph du JSON
   * @returns {Promise<string>} HTML du paragraphe
   */
  static async generate(paragraph) {
    if (!paragraph || !paragraph.text) {
      return '<p class="paragraph empty"></p>\n';
    }

    let html = '<p class="paragraph"';
    
    // Ajouter un ID si présent
    if (paragraph.id) {
      html += ` id="${paragraph.id}"`;
    }
    
    // Générer les styles inline
    const styles = GenerateParagraph.buildStyles(paragraph.styles || {});
    if (styles) {
      html += ` style="${styles}"`;
    }
    
    html += '>';
    
    // Échapper et insérer le texte
    html += GenerateParagraph.escapeHtml(paragraph.text);
    
    html += '</p>\n';
    
    return html;
  }

  /**
   * Construit la chaîne de styles CSS depuis l'objet styles
   * @param {Object} styles - Objet styles
   * @returns {string} Chaîne de styles CSS
   */
  static buildStyles(styles) {
    const cssProperties = [];
    
    // Font size
    if (styles.fontSize) {
      cssProperties.push(`font-size: ${styles.fontSize}pt`);
    }
    
    // Font family
    if (styles.fontFamily) {
      cssProperties.push(`font-family: ${styles.fontFamily}`);
    }
    
    // Font weight (bold)
    if (styles.bold || styles.fontWeight === 'bold') {
      cssProperties.push('font-weight: bold');
    }
    
    // Font style (italic)
    if (styles.italic || styles.fontStyle === 'italic') {
      cssProperties.push('font-style: italic');
    }
    
    // Text decoration (underline)
    if (styles.underline) {
      cssProperties.push('text-decoration: underline');
    }
    
    // Text align
    if (styles.alignment) {
      cssProperties.push(`text-align: ${styles.alignment}`);
    }
    
    // Color
    if (styles.color) {
      cssProperties.push(`color: ${styles.color}`);
    }
    
    // Background color
    if (styles.backgroundColor) {
      cssProperties.push(`background-color: ${styles.backgroundColor}`);
    }
    
    // Line height (depuis spacing.line)
    if (styles.spacing && styles.spacing.line) {
      // Appliquer selon le type : fixe (en pt) ou multiple (sans unité)
      if (styles.spacing.lineType === 'fixed') {
        // Valeur fixe en points : ex. 30pt
        cssProperties.push(`line-height: ${styles.spacing.line}pt`);
      } else {
        // Multiple relatif : ex. 1.5 (sans unité)
        cssProperties.push(`line-height: ${styles.spacing.line}`);
      }
    }
    
    // Margin
    if (styles.marginTop) {
      cssProperties.push(`margin-top: ${styles.marginTop}pt`);
    }
    if (styles.marginBottom) {
      cssProperties.push(`margin-bottom: ${styles.marginBottom}pt`);
    }
    
    return cssProperties.join('; ');
  }

  /**
   * Échappe le HTML
   * @param {string} text - Texte à échapper
   * @returns {string} Texte échappé
   */
  static escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

module.exports = GenerateParagraph;
