/**
 * Utilitaires pour refactoriser le template depuis le HTML
 * Extrait le HTML de l'éditeur et recrée la structure JSON
 */

import { buildHierarchy } from './sectionHierarchy.js';

/**
 * Extrait la structure depuis le HTML de l'éditeur (liste plate)
 * @param {HTMLElement} editorElement - Élément contentEditable de l'éditeur
 * @returns {Array} - Liste plate de sections avec leurs titres et contenus
 */
export function extractStructureFromHTML(editorElement) {
  if (!editorElement) return [];
  
  const flatSections = [];
  const children = Array.from(editorElement.children);
  
  let currentSection = null;
  let currentParagraphs = [];
  
  for (let i = 0; i < children.length; i++) {
    const element = children[i];
    
    // Si c'est un titre (h1, h2, h3 ou div avec classe doc-title-level-X)
    const tagName = element.tagName ? element.tagName.toLowerCase() : '';
    const className = element.className || '';
    let level = null;
    
    if (/^h[1-3]$/i.test(tagName)) {
      level = parseInt(tagName.charAt(1));
    } else if (tagName === 'div' && /doc-title-level-[1-3]/.test(className)) {
      const match = className.match(/doc-title-level-([1-3])/);
      level = match ? parseInt(match[1]) : null;
    }
    
    if (level) {
      // Sauvegarder la section précédente si elle existe
      if (currentSection) {
        currentSection.paragraphs = currentParagraphs.map(p => p.innerHTML);
        flatSections.push(currentSection);
      }
      
      // Créer une nouvelle section
      const sectionId = element.dataset.sectionId || `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Extraire le titre (sans la numérotation si elle existe)
      // La numérotation est au format "1. ", "a. ", "I. ", etc. suivi d'un espace
      let titleText = element.textContent.trim();
      
      // Retirer la numérotation hiérarchique au début (format: "1.1. ", "1.2. ", etc.)
      // On retire tout jusqu'au premier espace après le dernier point de numérotation
      titleText = titleText.replace(/^[\d\w\.]+\s+/, '').trim();
      
      // Si après le remplacement il ne reste rien ou très peu, garder le texte original
      if (!titleText || titleText.length < 2) {
        titleText = element.textContent.trim();
      }
      
      currentSection = {
        id: sectionId,
        type: 'section',
        level: level,
        title: titleText || 'Sans titre',
        visibleInTOC: true,
        paragraphs: [],
        sections: []
      };
      
      currentParagraphs = [];
    } else {
      // C'est un paragraphe ou autre contenu
      // Ne garder que les éléments non vides
      const innerHTML = element.innerHTML.trim();
      if (innerHTML && innerHTML !== '<br>') {
        currentParagraphs.push(element);
      }
    }
  }
  
  // Sauvegarder la dernière section
  if (currentSection) {
    currentSection.paragraphs = currentParagraphs.map(p => p.innerHTML);
    flatSections.push(currentSection);
  }
  
  // Construire la hiérarchie depuis la liste plate
  return buildHierarchy(flatSections);
}

