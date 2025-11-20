/**
 * Génération : Tableau
 * Fichier : backend/modules/agent-documentaire/generators/methodes/generate-table.js
 * 
 * Fonction : Génère le HTML pour un tableau avec styles
 */

class GenerateTable {
  /**
   * Génère le HTML pour un tableau
   * @param {Object} table - Objet table du JSON
   * @returns {Promise<string>} HTML du tableau
   */
  static async generate(table) {
    if (!table || !table.rows || !Array.isArray(table.rows)) {
      return '';
    }

    let html = '<table class="table"';
    
    // Ajouter un ID si présent
    if (table.id) {
      html += ` id="${table.id}"`;
    }
    
    // Générer les styles du tableau
    const styles = GenerateTable.buildTableStyles(table.styles || {});
    if (styles) {
      html += ` style="${styles}"`;
    }
    
    html += '>\n';
    
    // Générer les lignes
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
      const row = table.rows[rowIndex];
      const isHeaderRow = rowIndex === 0 && table.headerRow !== false;
      
      html += GenerateTable.generateRow(row, isHeaderRow, rowIndex);
    }
    
    html += '</table>\n';
    
    return html;
  }

  /**
   * Génère le HTML pour une ligne de tableau
   * @param {Object} row - Objet row
   * @param {boolean} isHeaderRow - Si c'est une ligne d'en-tête
   * @param {number} rowIndex - Index de la ligne
   * @returns {string} HTML de la ligne
   */
  static generateRow(row, isHeaderRow, rowIndex) {
    let html = '  <tr';
    
    // Styles de la ligne
    const rowStyles = GenerateTable.buildRowStyles(row.styles || {});
    if (rowStyles) {
      html += ` style="${rowStyles}"`;
    }
    
    html += '>\n';
    
    // Générer les cellules
    if (row.cells && Array.isArray(row.cells)) {
      for (const cell of row.cells) {
        const tag = isHeaderRow ? 'th' : 'td';
        html += GenerateTable.generateCell(cell, tag);
      }
    }
    
    html += '  </tr>\n';
    
    return html;
  }

  /**
   * Génère le HTML pour une cellule
   * @param {Object} cell - Objet cell
   * @param {string} tag - Balise HTML (td ou th)
   * @returns {string} HTML de la cellule
   */
  static generateCell(cell, tag = 'td') {
    let html = `    <${tag}`;
    
    // Colspan
    if (cell.colspan && cell.colspan > 1) {
      html += ` colspan="${cell.colspan}"`;
    }
    
    // Rowspan
    if (cell.rowspan && cell.rowspan > 1) {
      html += ` rowspan="${cell.rowspan}"`;
    }
    
    // Styles de la cellule
    const cellStyles = GenerateTable.buildCellStyles(cell.styles || {});
    if (cellStyles) {
      html += ` style="${cellStyles}"`;
    }
    
    html += '>';
    
    // Contenu de la cellule
    if (cell.content) {
      html += GenerateTable.escapeHtml(cell.content);
    } else if (cell.text) {
      html += GenerateTable.escapeHtml(cell.text);
    }
    
    html += `</${tag}>\n`;
    
    return html;
  }

  /**
   * Construit les styles CSS pour le tableau
   * @param {Object} styles - Objet styles
   * @returns {string} Chaîne de styles CSS
   */
  static buildTableStyles(styles) {
    const cssProperties = [];
    
    if (styles.width) {
      cssProperties.push(`width: ${styles.width}`);
    }
    if (styles.borderCollapse) {
      cssProperties.push('border-collapse: collapse');
    }
    
    return cssProperties.join('; ');
  }

  /**
   * Construit les styles CSS pour une ligne
   * @param {Object} styles - Objet styles
   * @returns {string} Chaîne de styles CSS
   */
  static buildRowStyles(styles) {
    const cssProperties = [];
    
    if (styles.backgroundColor) {
      cssProperties.push(`background-color: ${styles.backgroundColor}`);
    }
    
    return cssProperties.join('; ');
  }

  /**
   * Construit les styles CSS pour une cellule
   * @param {Object} styles - Objet styles
   * @returns {string} Chaîne de styles CSS
   */
  static buildCellStyles(styles) {
    const cssProperties = [];
    
    if (styles.backgroundColor) {
      cssProperties.push(`background-color: ${styles.backgroundColor}`);
    }
    if (styles.textAlign) {
      cssProperties.push(`text-align: ${styles.textAlign}`);
    }
    if (styles.border) {
      cssProperties.push(`border: ${styles.border}`);
    }
    if (styles.padding) {
      cssProperties.push(`padding: ${styles.padding}`);
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

module.exports = GenerateTable;
