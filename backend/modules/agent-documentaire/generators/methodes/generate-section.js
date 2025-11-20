/**
 * Génération : Section
 * Fichier : backend/modules/agent-documentaire/generators/methodes/generate-section.js
 * 
 * Fonction : Génère le HTML pour une section (titre + contenu)
 */

const { getTagConfig } = require('../json-tags-config');

class GenerateSection {
  /**
   * Génère le HTML pour une section
   * @param {Object} section - Objet section du JSON
   * @returns {Promise<string>} HTML de la section
   */
  static async generate(section) {
    if (!section || !section.type) {
      return '';
    }

    let html = '<section class="section"';
    
    // Ajouter un ID si présent
    if (section.id) {
      html += ` id="${section.id}"`;
    }
    
    // Ajouter un anchor si présent
    if (section.anchor) {
      html += ` id="${section.anchor}"`;
    }
    
    html += '>\n';
    
    // Générer le titre de la section
    if (section.title) {
      const level = section.level || 1;
      const numbering = section.numbering ? `${section.numbering} ` : '';
      const titleText = GenerateSection.escapeHtml(section.title);
      
      html += `  <h${Math.min(level, 6)} class="section-title level-${level}">`;
      html += `${numbering}${titleText}`;
      html += `</h${Math.min(level, 6)}>\n`;
    }
    
    // Générer le contenu de la section
    if (section.content && Array.isArray(section.content)) {
      html += '  <div class="section-content">\n';
      
      for (const item of section.content) {
        const config = getTagConfig(item.type);
        if (config && config.getMethod) {
          const method = config.getMethod();
          if (method) {
            try {
              const itemHtml = await method(item);
              html += '    ' + itemHtml.split('\n').join('\n    ') + '\n';
            } catch (error) {
              console.error(`❌ Erreur lors de la génération de ${item.type}:`, error.message);
            }
          }
        }
      }
      
      html += '  </div>\n';
    }
    
    // Générer les sous-sections (children)
    if (section.children && Array.isArray(section.children) && section.children.length > 0) {
      for (const child of section.children) {
        if (child.type === 'section' || child.type === 'introduction') {
          const childHtml = await GenerateSection.generate(child);
          html += '  ' + childHtml.split('\n').join('\n  ') + '\n';
        }
      }
    }
    
    html += '</section>\n';
    
    return html;
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

module.exports = GenerateSection;
