/**
 * Utilitaires pour gérer la hiérarchie des sections
 */

/**
 * Aplatit une structure hiérarchique de sections en liste plate
 * @param {Array} sections - Liste de sections (peut contenir des sous-sections)
 * @returns {Array} - Liste plate de sections avec leur chemin hiérarchique
 */
export function flattenSections(sections) {
  const flatList = [];
  
  function traverse(sectionList, path = []) {
    sectionList.forEach((section, index) => {
      const currentPath = [...path, index];
      flatList.push({
        section: section,
        path: currentPath
      });
      
      // Traverser les sous-sections récursivement
      if (section.sections && section.sections.length > 0) {
        traverse(section.sections, currentPath);
      }
    });
  }
  
  traverse(sections || []);
  return flatList;
}

/**
 * Construit une structure hiérarchique depuis une liste plate de sections
 * Les sections h2 sont attachées au h1 précédent, les h3 au h2 précédent, etc.
 * @param {Array} flatSections - Liste plate de sections avec leurs niveaux
 * @returns {Array} - Structure hiérarchique de sections
 */
export function buildHierarchy(flatSections) {
  const hierarchy = [];
  const stack = []; // Stack pour suivre les sections en cours à chaque niveau
  
  flatSections.forEach(section => {
    const level = section.level || 1;
    
    // Nettoyer la stack pour ne garder que les niveaux supérieurs ou égaux
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    
    // Créer une nouvelle section (copie propre)
    const newSection = {
      id: section.id,
      type: section.type || 'section',
      level: level,
      title: section.title || 'Sans titre',
      visibleInTOC: section.visibleInTOC !== false,
      paragraphs: section.paragraphs || [],
      sections: []
    };
    
    // Si la stack est vide, c'est une section de niveau 1 (racine)
    if (stack.length === 0) {
      hierarchy.push(newSection);
      stack.push({ level: level, section: newSection });
    } else {
      // Sinon, l'ajouter comme sous-section du parent actuel
      const parent = stack[stack.length - 1].section;
      if (!parent.sections) {
        parent.sections = [];
      }
      parent.sections.push(newSection);
      stack.push({ level: level, section: newSection });
    }
  });
  
  return hierarchy;
}

/**
 * Trouve une section dans une hiérarchie par son ID (recherche récursive)
 * @param {Array} sections - Liste de sections (hiérarchique)
 * @param {string} sectionId - ID de la section à trouver
 * @param {Array} path - Chemin actuel (pour le retour)
 * @returns {Object|null} - { section, path, parentList, index } ou null
 */
export function findSectionInHierarchy(sections, sectionId, path = [], parentList = null, parentIndex = -1) {
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const currentPath = [...path, i];
    
    if (section.id === sectionId) {
      return {
        section: section,
        path: currentPath,
        parentList: parentList || sections,
        index: i
      };
    }
    
    // Rechercher dans les sous-sections
    if (section.sections && section.sections.length > 0) {
      const found = findSectionInHierarchy(section.sections, sectionId, currentPath, section.sections, i);
      if (found) {
        return found;
      }
    }
  }
  
  return null;
}

/**
 * Extrait une section de la hiérarchie (avec toutes ses sous-sections)
 * @param {Array} sections - Liste de sections (hiérarchique)
 * @param {string} sectionId - ID de la section à extraire
 * @returns {Object|null} - { section, parentList, index } ou null
 */
export function extractSectionFromHierarchy(sections, sectionId) {
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    if (section.id === sectionId) {
      // Retirer la section de la liste parente
      const extracted = sections.splice(i, 1)[0];
      return {
        section: extracted,
        parentList: sections,
        index: i
      };
    }
    
    // Rechercher dans les sous-sections
    if (section.sections && section.sections.length > 0) {
      const found = extractSectionFromHierarchy(section.sections, sectionId);
      if (found) {
        return found;
      }
    }
  }
  
  return null;
}

/**
 * Insère une section dans la hiérarchie juste avant la section cible
 * @param {Array} sections - Liste de sections (hiérarchique)
 * @param {string} targetSectionId - ID de la section cible
 * @param {Object} sectionToInsert - Section à insérer (avec toutes ses sous-sections)
 * @returns {boolean} - true si l'insertion a réussi, false sinon
 */
export function insertSectionInHierarchy(sections, targetSectionId, sectionToInsert) {
  // Trouver la section cible dans la hiérarchie
  const target = findSectionInHierarchy(sections, targetSectionId);
  
  if (!target) {
    return false;
  }
  
  // Insérer la section juste avant la section cible dans sa liste parente
  // Cela préserve la hiérarchie : la section est insérée au même niveau que la cible
  target.parentList.splice(target.index, 0, sectionToInsert);
  
  return true;
}
