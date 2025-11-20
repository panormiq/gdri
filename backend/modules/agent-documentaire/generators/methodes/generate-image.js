/**
 * Génération : Image
 * Fichier : backend/modules/agent-documentaire/generators/methodes/generate-image.js
 * 
 * Fonction : Génère le HTML pour une image avec position, dimensions, crop, etc.
 */

class GenerateImage {
  /**
   * Génère le HTML pour une image
   * @param {Object} image - Objet image du JSON
   * @returns {Promise<string>} HTML de l'image
   */
  static async generate(image) {
    if (!image || !image.src) {
      return '';
    }

    let html = '<div class="image"';
    
    // Ajouter un ID si présent
    if (image.id) {
      html += ` id="${image.id}"`;
    }
    
    // Générer les styles pour la position et les dimensions
    const styles = GenerateImage.buildStyles(image);
    if (styles) {
      html += ` style="${styles}"`;
    }
    
    html += '>\n';
    
    // Générer la balise img
    html += '  <img';
    html += ` src="${GenerateImage.escapeHtml(image.src)}"`;
    html += ` alt="${GenerateImage.escapeHtml(image.alt || '')}"`;
    
    // Dimensions
    if (image.width) {
      html += ` width="${image.width}"`;
    }
    if (image.height) {
      html += ` height="${image.height}"`;
    }
    
    html += ' />\n';
    html += '</div>\n';
    
    return html;
  }

  /**
   * Construit la chaîne de styles CSS pour l'image
   * @param {Object} image - Objet image
   * @returns {string} Chaîne de styles CSS
   */
  static buildStyles(image) {
    const cssProperties = [];
    
    // Position (absolute si anchor, inline sinon)
    if (image.position === 'absolute' || image.anchor) {
      cssProperties.push('position: absolute');
      
      if (image.x !== undefined) {
        cssProperties.push(`left: ${image.x}pt`);
      }
      if (image.y !== undefined) {
        cssProperties.push(`top: ${image.y}pt`);
      }
    } else {
      cssProperties.push('position: relative');
      cssProperties.push('display: block');
      cssProperties.push('margin: 20px auto');
    }
    
    // Dimensions
    if (image.width && !image.locked?.width) {
      cssProperties.push(`width: ${image.width}pt`);
    }
    if (image.height && !image.locked?.height) {
      cssProperties.push(`height: ${image.height}pt`);
    }
    
    // Crop (object-fit et object-position)
    if (image.crop) {
      cssProperties.push('object-fit: cover');
      if (image.crop.left !== undefined || image.crop.top !== undefined) {
        const left = image.crop.left || 0;
        const top = image.crop.top || 0;
        cssProperties.push(`object-position: ${left}% ${top}%`);
      }
    }
    
    // Rotation
    if (image.rotation) {
      cssProperties.push(`transform: rotate(${image.rotation}deg)`);
    }
    
    // Border
    if (image.border) {
      if (image.border.width) {
        cssProperties.push(`border: ${image.border.width}pt solid ${image.border.color || '#000'}`);
      }
    }
    
    // Shadow
    if (image.shadow) {
      const shadow = image.shadow;
      const offsetX = shadow.offsetX || 0;
      const offsetY = shadow.offsetY || 0;
      const blur = shadow.blur || 0;
      const color = shadow.color || 'rgba(0,0,0,0.3)';
      cssProperties.push(`box-shadow: ${offsetX}pt ${offsetY}pt ${blur}pt ${color}`);
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

module.exports = GenerateImage;
