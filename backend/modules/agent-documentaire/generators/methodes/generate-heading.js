/**
 * Méthode de génération : Titre
 * Fichier : backend/modules/agent-documentaire/generators/methodes/generate-heading.js
 * 
 * Fonction : Génère le HTML d'un titre depuis le JSON
 */

class GenerateHeading {
  /**
   * Génère le HTML d'un titre
   * @param {Object} heading - Objet titre depuis JSON
   * @returns {string} HTML du titre
   */
  static generate(heading) {
    // TODO: Implémenter la génération HTML
    // - Utiliser les balises h1, h2, etc. selon le niveau
    // - Appliquer les styles
    // - Ajouter les attributs data-* pour l'édition
    
    const level = heading.level || 1;
    const tag = `h${Math.min(level, 6)}`;
    const styles = heading.styles || {};
    const styleAttr = this.buildStyleAttribute(styles);
    
    return `<${tag} class="editable-heading" data-id="${heading.id}" data-level="${level}" ${styleAttr}>${heading.text || ''}</${tag}>`;
  }
  
  /**
   * Construit l'attribut style depuis les styles
   */
  static buildStyleAttribute(styles) {
    const cssProps = [];
    
    if (styles.fontSize) {
      cssProps.push(`font-size: ${styles.fontSize}px`);
    }
    if (styles.color) {
      cssProps.push(`color: ${styles.color}`);
    }
    
    return cssProps.length > 0 ? `style="${cssProps.join('; ')}"` : '';
  }
}

module.exports = GenerateHeading;

