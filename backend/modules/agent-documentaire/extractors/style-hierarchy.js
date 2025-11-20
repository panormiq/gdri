/**
 * Analyseur de hiérarchie de styles Word
 * Fichier : backend/modules/agent-documentaire/extractors/style-hierarchy.js
 * 
 * Fonction : Analyse les styles personnalisés du document pour créer une hiérarchie
 * de titres automatique, même si les styles ne s'appellent pas "Heading1-6"
 */

class StyleHierarchy {
  /**
   * Analyse les styles et crée une hiérarchie de titres
   * @param {Object} documentStyles - Styles extraits depuis word/styles.xml
   * @param {Array} tocStyles - Styles utilisés dans le TOC (TM1, TM2, etc.) - optionnel
   * @returns {Object} Hiérarchie des styles de titres
   */
  static analyze(documentStyles, tocStyles = []) {
    if (!documentStyles || Object.keys(documentStyles).length === 0) {
      return this.getDefaultHierarchy();
    }

    // Étape 1 : Identifier les styles qui sont probablement des titres
    const potentialHeadings = this.identifyPotentialHeadings(documentStyles);
    
    // Étape 2 : Analyser la hiérarchie via w:next et w:basedOn
    const hierarchyFromNext = this.analyzeHierarchyFromNext(documentStyles);
    
    // Étape 3 : Analyser la hiérarchie via les noms de styles (Titre1, Titre2, etc.)
    const hierarchyFromNames = this.analyzeHierarchyFromNames(documentStyles);
    
    // Étape 3.5 : Analyser les styles TOC (TM1, TM2, etc.) et les mapper aux niveaux
    const hierarchyFromToc = this.analyzeHierarchyFromToc(documentStyles, tocStyles);
    
    // Étape 4 : Créer une hiérarchie combinée basée sur les propriétés (taille, espacement, etc.)
    const hierarchyFromProps = this.createHierarchy(potentialHeadings);
    
    // Étape 5 : Fusionner toutes les hiérarchies (priorité : TOC > noms > w:next > propriétés)
    const mergedHierarchy = this.mergeHierarchies(hierarchyFromNext, hierarchyFromNames, hierarchyFromProps, hierarchyFromToc);
    
    // Étape 6 : Mapper les styles existants vers les niveaux de hiérarchie
    const styleToLevel = this.mapStylesToLevels(documentStyles, mergedHierarchy);
    
    console.log(`📊 Hiérarchie de styles créée : ${Object.keys(styleToLevel).length} styles de titres identifiés`);
    if (Object.keys(styleToLevel).length > 0) {
      console.log(`   Styles: ${Object.keys(styleToLevel).join(', ')}`);
    }
    
    return {
      hierarchy: mergedHierarchy,
      styleToLevel: styleToLevel,
      potentialHeadings: potentialHeadings
    };
  }

  /**
   * Identifie les styles qui sont probablement des titres
   * Critères :
   * - Taille de police plus grande que le style Normal
   * - Texte en gras
   * - Espacement avant/après plus important
   * - Nom du style contient "titre", "heading", "heading", etc.
   */
  static identifyPotentialHeadings(documentStyles) {
    const potentialHeadings = [];
    
    // Trouver le style Normal comme référence
    const normalStyle = documentStyles['Normal'] || 
                       Object.values(documentStyles).find(s => 
                         s.name && s.name.toLowerCase().includes('normal')
                       ) ||
                       { run: { fontSize: 12 }, paragraph: { spacing: { before: 0, after: 0 } } };
    
    const normalFontSize = normalStyle.run?.fontSize || 12;
    const normalSpacingBefore = normalStyle.paragraph?.spacing?.before || 0;
    const normalSpacingAfter = normalStyle.paragraph?.spacing?.after || 0;
    
    for (const [styleId, style] of Object.entries(documentStyles)) {
      // Ignorer les styles de caractère et de tableau
      if (style.type !== 'paragraph') {
        continue;
      }
      
      // Ignorer le style Normal lui-même
      if (styleId === 'Normal' || style.name?.toLowerCase().includes('normal')) {
        continue;
      }
      
      const runProps = style.run || {};
      const paragraphProps = style.paragraph || {};
      const spacing = paragraphProps.spacing || {};
      
      let score = 0;
      const indicators = [];
      
      // Critère 1 : Taille de police plus grande
      const fontSize = runProps.fontSize || normalFontSize;
      if (fontSize > normalFontSize) {
        score += (fontSize - normalFontSize) * 2;
        indicators.push(`fontSize: ${fontSize}`);
      }
      
      // Critère 2 : Texte en gras
      if (runProps.bold === true) {
        score += 10;
        indicators.push('bold');
      }
      
      // Critère 3 : Espacement avant plus important
      const spacingBefore = spacing.before || 0;
      if (spacingBefore > normalSpacingBefore) {
        score += spacingBefore / 2;
        indicators.push(`spacingBefore: ${spacingBefore}`);
      }
      
      // Critère 4 : Espacement après plus important
      const spacingAfter = spacing.after || 0;
      if (spacingAfter > normalSpacingAfter) {
        score += spacingAfter / 2;
        indicators.push(`spacingAfter: ${spacingAfter}`);
      }
      
      // Critère 5 : Nom du style suggère un titre
      const styleName = (style.name || styleId).toLowerCase();
      if (styleName.includes('titre') || 
          styleName.includes('heading') || 
          styleName.includes('title') ||
          styleName.includes('heading') ||
          styleName.match(/^titre\s*\d+/) ||
          styleName.match(/^heading\s*\d+/)) {
        score += 20;
        indicators.push('name suggests heading');
      }
      
      // Critère 6 : Texte en majuscules
      if (runProps.caps === true) {
        score += 5;
        indicators.push('caps');
      }
      
      // Si le score est suffisant, c'est probablement un titre
      if (score >= 15) {
        potentialHeadings.push({
          styleId: styleId,
          styleName: style.name || styleId,
          score: score,
          indicators: indicators,
          fontSize: fontSize,
          bold: runProps.bold || false,
          spacingBefore: spacingBefore,
          spacingAfter: spacingAfter,
          style: style
        });
      }
    }
    
    // Trier par score décroissant
    potentialHeadings.sort((a, b) => b.score - a.score);
    
    return potentialHeadings;
  }

  /**
   * Crée une hiérarchie de titres basée sur les propriétés des styles
   * @param {Array} potentialHeadings - Styles identifiés comme titres
   * @returns {Array} Hiérarchie ordonnée (du niveau 1 au niveau le plus bas)
   */
  static createHierarchy(potentialHeadings) {
    if (potentialHeadings.length === 0) {
      return [];
    }
    
    // Trier par taille de police décroissante, puis par espacement
    const sorted = [...potentialHeadings].sort((a, b) => {
      // D'abord par taille de police
      if (b.fontSize !== a.fontSize) {
        return b.fontSize - a.fontSize;
      }
      // Puis par espacement avant
      if (b.spacingBefore !== a.spacingBefore) {
        return b.spacingBefore - a.spacingBefore;
      }
      // Puis par score
      return b.score - a.score;
    });
    
    // Créer la hiérarchie avec des niveaux
    const hierarchy = [];
    for (let i = 0; i < sorted.length; i++) {
      const heading = sorted[i];
      hierarchy.push({
        level: i + 1,
        styleId: heading.styleId,
        styleName: heading.styleName,
        fontSize: heading.fontSize,
        spacingBefore: heading.spacingBefore,
        spacingAfter: heading.spacingAfter,
        score: heading.score
      });
    }
    
    return hierarchy;
  }

  /**
   * Mappe les styles vers les niveaux de hiérarchie
   * @param {Object} documentStyles - Tous les styles du document
   * @param {Array} hierarchy - Hiérarchie créée
   * @returns {Object} Mapping styleId -> level
   */
  static mapStylesToLevels(documentStyles, hierarchy) {
    const styleToLevel = {};
    
    // Mapper les styles de la hiérarchie
    for (const item of hierarchy) {
      styleToLevel[item.styleId] = item.level;
    }
    
    // Ajouter aussi les styles Heading1-6 standards s'ils existent
    for (let i = 1; i <= 6; i++) {
      const headingId = `Heading${i}`;
      if (documentStyles[headingId] && !styleToLevel[headingId]) {
        styleToLevel[headingId] = i;
      }
    }
    
    // NE PAS normaliser les niveaux - garder les niveaux originaux
    // La normalisation pourrait écraser les niveaux corrects (ex: Titre1=1, Titre2=2, Titre3=3)
    // Si on normalise, on pourrait avoir Titre1=1, Titre2=1, Titre3=1 si tous commencent à 1
    
    return styleToLevel;
  }

  /**
   * Détermine le niveau d'un style
   * @param {string} styleId - ID du style
   * @param {Object} styleHierarchy - Hiérarchie de styles
   * @returns {number|null} Niveau du titre ou null si ce n'est pas un titre
   */
  static getHeadingLevel(styleId, styleHierarchy) {
    if (!styleId || !styleHierarchy || !styleHierarchy.styleToLevel) {
      return null;
    }
    
    return styleHierarchy.styleToLevel[styleId] || null;
  }

  /**
   * Vérifie si un style est un titre selon la hiérarchie
   * @param {string} styleId - ID du style
   * @param {Object} styleHierarchy - Hiérarchie de styles
   * @returns {boolean} True si c'est un titre
   */
  static isHeading(styleId, styleHierarchy) {
    return this.getHeadingLevel(styleId, styleHierarchy) !== null;
  }

  /**
   * Analyse la hiérarchie via les propriétés w:next et w:basedOn
   * @param {Object} documentStyles - Tous les styles
   * @returns {Object} Mapping styleId -> level basé sur w:next
   */
  static analyzeHierarchyFromNext(documentStyles) {
    const styleToLevel = {};
    const processed = new Set();
    
    // Trouver les styles de base (ceux qui n'ont pas de w:basedOn ou w:basedOn = Normal)
    const baseStyles = [];
    for (const [styleId, style] of Object.entries(documentStyles)) {
      if (style.type === 'paragraph' && 
          (!style.basedOn || style.basedOn === 'Normal' || style.basedOn === 'Default Paragraph Font')) {
        // Vérifier si c'est un titre (via nom ou propriétés)
        if (this.isLikelyHeading(style)) {
          baseStyles.push(styleId);
        }
      }
    }
    
    // Pour chaque style de base, suivre la chaîne w:next pour créer la hiérarchie
    for (const baseStyleId of baseStyles) {
      let currentStyleId = baseStyleId;
      let level = 1;
      
      while (currentStyleId && !processed.has(currentStyleId)) {
        const style = documentStyles[currentStyleId];
        if (!style || style.type !== 'paragraph') {
          break;
        }
        
        // Si c'est un titre, l'assigner au niveau actuel
        if (this.isLikelyHeading(style)) {
          styleToLevel[currentStyleId] = level;
          processed.add(currentStyleId);
        }
        
        // Passer au style suivant
        currentStyleId = style.next;
        level++;
        
        // Protection contre les boucles infinies
        if (level > 10) {
          break;
        }
      }
    }
    
    return styleToLevel;
  }

  /**
   * Analyse la hiérarchie via les noms de styles (Titre1, Titre2, Zep-Titre1, etc.)
   * @param {Object} documentStyles - Tous les styles
   * @returns {Object} Mapping styleId -> level basé sur les noms
   */
  static analyzeHierarchyFromNames(documentStyles) {
    const styleToLevel = {};
    
    for (const [styleId, style] of Object.entries(documentStyles)) {
      if (style.type !== 'paragraph') {
        continue;
      }
      
      // Chercher des patterns dans le nom : Titre1, Titre2, Heading1, Zep-Titre1, etc.
      const styleName = (style.name || styleId).toLowerCase();
      
      // Pattern 1 : "titre" suivi d'un chiffre (dans le nom ou l'ID)
      // Exemples : "Titre 1", "Zep - Titre 1", "Zep-Titre1", "Titre1"
      const titreMatch = styleName.match(/titre\s*(\d+)/i) || styleId.match(/titre\s*(\d+)/i);
      if (titreMatch) {
        const level = parseInt(titreMatch[1]);
        if (level >= 1 && level <= 9) {
          styleToLevel[styleId] = level;
          continue;
        }
      }
      
      // Pattern 2 : "heading" suivi d'un chiffre
      const headingMatch = styleName.match(/heading\s*(\d+)/i) || styleId.match(/heading\s*(\d+)/i);
      if (headingMatch) {
        const level = parseInt(headingMatch[1]);
        if (level >= 1 && level <= 9) {
          styleToLevel[styleId] = level;
          continue;
        }
      }
      
      // Pattern 3 : Style ID avec chiffre à la fin (Zep-Titre1, Heading1, Titre1, etc.)
      // Plus permissif : cherche un chiffre à la fin après "titre" ou "heading"
      const idMatch = styleId.match(/(?:titre|heading)(\d+)$/i) || styleId.match(/(\d+)$/);
      if (idMatch) {
        // Vérifier que c'est bien un style de titre (contient "titre" ou "heading")
        if (styleId.toLowerCase().includes('titre') || styleId.toLowerCase().includes('heading')) {
          const level = parseInt(idMatch[1]);
          if (level >= 1 && level <= 9) {
            styleToLevel[styleId] = level;
            continue;
          }
        }
      }
    }
    
    return styleToLevel;
  }

  /**
   * Vérifie si un style est probablement un titre
   * @param {Object} style - Style à vérifier
   * @returns {boolean} True si c'est probablement un titre
   */
  static isLikelyHeading(style) {
    const styleName = (style.name || '').toLowerCase();
    const styleId = (style.id || '').toLowerCase();
    
    // Vérifier le nom
    if (styleName.includes('titre') || 
        styleName.includes('heading') || 
        styleName.includes('title') ||
        styleId.includes('titre') ||
        styleId.includes('heading')) {
      return true;
    }
    
    // Vérifier les propriétés (taille, gras, espacement)
    const runProps = style.run || {};
    const paragraphProps = style.paragraph || {};
    
    if (runProps.bold === true || 
        (runProps.fontSize && runProps.fontSize > 12) ||
        (paragraphProps.spacing && paragraphProps.spacing.before > 6)) {
      return true;
    }
    
    return false;
  }

  /**
   * Analyse la hiérarchie depuis les styles TOC (TM1, TM2, etc.)
   * @param {Object} documentStyles - Tous les styles
   * @param {Array} tocStyles - Styles TOC détectés (TM1, TM2, etc.)
   * @returns {Object} Mapping styleId -> level basé sur les styles TOC
   */
  static analyzeHierarchyFromToc(documentStyles, tocStyles) {
    const styleToLevel = {};
    
    if (!tocStyles || tocStyles.length === 0) {
      return styleToLevel;
    }
    
    // Trier les styles TOC pour déterminer les niveaux
    // TM1 = niveau 1, TM2 = niveau 2, etc.
    const sortedTocStyles = [...tocStyles].sort();
    
    for (let i = 0; i < sortedTocStyles.length; i++) {
      const tocStyleId = sortedTocStyles[i];
      
      // Extraire le numéro du style TOC (TM1 -> 1, TM2 -> 2, etc.)
      const match = tocStyleId.match(/TM\s*(\d+)/i) || tocStyleId.match(/TOC\s*(\d+)/i);
      if (match) {
        const level = parseInt(match[1]);
        if (level >= 1 && level <= 9) {
          styleToLevel[tocStyleId] = level;
        }
      } else {
        // Si pas de numéro explicite, utiliser l'ordre (TM1 = 1, TM2 = 2, etc.)
        styleToLevel[tocStyleId] = i + 1;
      }
    }
    
    return styleToLevel;
  }

  /**
   * Fusionne plusieurs hiérarchies (priorité : TOC > noms > w:next > propriétés)
   * @param {Object} hierarchyFromNext - Hiérarchie depuis w:next
   * @param {Object} hierarchyFromNames - Hiérarchie depuis les noms
   * @param {Array} hierarchyFromProps - Hiérarchie depuis les propriétés
   * @param {Object} hierarchyFromToc - Hiérarchie depuis les styles TOC
   * @returns {Array} Hiérarchie fusionnée
   */
  static mergeHierarchies(hierarchyFromNext, hierarchyFromNames, hierarchyFromProps, hierarchyFromToc = {}) {
    const merged = [];
    const allLevels = new Map();
    
    // Priorité 1 : styles TOC (TM1, TM2, etc.) - le plus fiable car directement liés au TOC
    for (const [styleId, level] of Object.entries(hierarchyFromToc)) {
      allLevels.set(styleId, { level, source: 'toc' });
    }
    
    // Priorité 2 : noms (plus fiable pour Titre1, Titre2, Titre3)
    // Car w:next peut pointer vers Normal au lieu de la chaîne de titres
    for (const [styleId, level] of Object.entries(hierarchyFromNames)) {
      if (!allLevels.has(styleId)) {
        allLevels.set(styleId, { level, source: 'name' });
      }
    }
    
    // Priorité 3 : w:next (seulement si pas déjà défini)
    // Utile pour les styles personnalisés comme Zep-Titre1 qui ont une chaîne correcte
    for (const [styleId, level] of Object.entries(hierarchyFromNext)) {
      if (!allLevels.has(styleId)) {
        allLevels.set(styleId, { level, source: 'next' });
      }
    }
    
    // Priorité 4 : propriétés (seulement si pas déjà défini)
    for (const item of hierarchyFromProps) {
      if (!allLevels.has(item.styleId)) {
        allLevels.set(item.styleId, { level: item.level, source: 'props' });
      }
    }
    
    // Créer la liste fusionnée
    for (const [styleId, { level, source }] of allLevels.entries()) {
      merged.push({
        level: level,
        styleId: styleId,
        source: source
      });
    }
    
    // Trier par niveau
    merged.sort((a, b) => a.level - b.level);
    
    return merged;
  }

  /**
   * Retourne une hiérarchie par défaut
   * @returns {Object} Hiérarchie par défaut
   */
  static getDefaultHierarchy() {
    return {
      hierarchy: [],
      styleToLevel: {
        'Heading1': 1,
        'Heading2': 2,
        'Heading3': 3,
        'Heading4': 4,
        'Heading5': 5,
        'Heading6': 6
      },
      potentialHeadings: []
    };
  }
}

module.exports = StyleHierarchy;

