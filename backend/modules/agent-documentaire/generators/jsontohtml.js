/**
 * Génération JSON → HTML
 * Fichier : backend/modules/agent-documentaire/generators/jsontohtml.js
 * 
 * Fonction : Convertit le JSON extrait en HTML pour l'affichage
 * Utilise json-tags-config.js pour savoir comment générer chaque type d'élément
 */

const { getTagConfig, getSupportedTags } = require('./json-tags-config');

class JsonToHtml {
  /**
   * Génère le HTML depuis le JSON
   * @param {Object} documentJson - JSON du document extrait
   * @param {Object} options - Options de génération (theme, styles, etc.)
   * @returns {Promise<string>} HTML généré
   */
  static async generate(documentJson, options = {}) {
    const {
      theme = 'default',
      includeStyles = true,
      includeToc = true,
      tocCollapsible = true
    } = options;

    let html = '<!DOCTYPE html>\n<html lang="fr">\n<head>\n';
    html += '<meta charset="UTF-8">\n';
    html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
    html += `<title>${documentJson.metadata?.title || 'Document'}</title>\n`;
    
    if (includeStyles) {
      html += '<style>\n';
      html += this.generateStyles(theme);
      html += '</style>\n';
    }
    
    html += '</head>\n<body>\n';
    
    // Générer le TOC si demandé
    if (includeToc && documentJson.toc && documentJson.toc.length > 0) {
      html += this.generateToc(documentJson.toc, tocCollapsible);
    }
    
    // Générer le contenu principal
    html += '<div class="document-content">\n';
    html += await this.generateSections(documentJson.sections || []);
    html += '</div>\n';
    
    html += '</body>\n</html>';
    
    return html;
  }

  /**
   * Génère les sections (récursif)
   * @param {Array} sections - Tableau de sections
   * @returns {Promise<string>} HTML des sections
   */
  static async generateSections(sections) {
    let html = '';
    
    for (const section of sections) {
      const config = getTagConfig(section.type);
      if (config && config.getMethod) {
        const method = config.getMethod();
        if (method) {
          try {
            const sectionHtml = await method(section);
            html += sectionHtml;
          } catch (error) {
            console.error(`❌ Erreur lors de la génération de ${section.type}:`, error.message);
          }
        }
      }
    }
    
    return html;
  }

  /**
   * Génère le TOC (Table of Contents)
   * @param {Array} toc - Table des matières
   * @param {boolean} collapsible - Si le TOC est pliable
   * @returns {string} HTML du TOC
   */
  static generateToc(toc, collapsible = true) {
    let html = '<nav class="table-of-contents">\n';
    html += '<h2>Table des matières</h2>\n';
    html += '<ul>\n';
    
    for (const entry of toc) {
      if (entry.type === 'separator') {
        html += '<li class="toc-separator"><hr></li>\n';
        continue;
      }
      
      const level = entry.level || 1;
      const indent = level - 1;
      const numbering = entry.numbering ? `${entry.numbering} ` : '';
      const title = entry.title || '';
      const anchor = entry.anchor ? `#${entry.anchor}` : '';
      
      html += `<li class="toc-level-${level}" style="padding-left: ${indent * 20}px;">\n`;
      html += `  <a href="${anchor}">${numbering}${this.escapeHtml(title)}</a>\n`;
      html += '</li>\n';
    }
    
    html += '</ul>\n';
    html += '</nav>\n';
    
    return html;
  }

  /**
   * Génère les styles CSS
   * @param {string} theme - Thème à utiliser
   * @returns {string} CSS
   */
  static generateStyles(theme = 'default') {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333;
        background: #f5f5f5;
        padding: 20px;
      }
      
      .table-of-contents {
        background: white;
        padding: 20px;
        margin-bottom: 30px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .table-of-contents h2 {
        margin-bottom: 15px;
        color: #2c3e50;
      }
      
      .table-of-contents ul {
        list-style: none;
      }
      
      .table-of-contents li {
        margin: 5px 0;
      }
      
      .table-of-contents a {
        text-decoration: none;
        color: #3498db;
        transition: color 0.3s;
      }
      
      .table-of-contents a:hover {
        color: #2980b9;
      }
      
      .toc-separator {
        margin: 15px 0;
      }
      
      .document-content {
        background: white;
        padding: 40px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        max-width: 1200px;
        margin: 0 auto;
      }
      
      .section {
        margin-bottom: 40px;
      }
      
      .section-title {
        font-weight: bold;
        margin-bottom: 15px;
        color: #2c3e50;
      }
      
      .section-title.level-1 {
        font-size: 2em;
        border-bottom: 3px solid #3498db;
        padding-bottom: 10px;
      }
      
      .section-title.level-2 {
        font-size: 1.5em;
        border-bottom: 2px solid #3498db;
        padding-bottom: 8px;
      }
      
      .section-title.level-3 {
        font-size: 1.2em;
        color: #34495e;
      }
      
      .paragraph {
        margin-bottom: 15px;
        line-height: 1.8;
      }
      
      .image {
        margin: 20px 0;
        text-align: center;
      }
      
      .image img {
        max-width: 100%;
        height: auto;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      
      .table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }
      
      .table th,
      .table td {
        border: 1px solid #ddd;
        padding: 12px;
        text-align: left;
      }
      
      .table th {
        background-color: #3498db;
        color: white;
        font-weight: bold;
      }
      
      .table tr:nth-child(even) {
        background-color: #f9f9f9;
      }
    `;
  }

  /**
   * Échappe le HTML pour éviter les injections
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

module.exports = { generate: JsonToHtml.generate.bind(JsonToHtml) };
