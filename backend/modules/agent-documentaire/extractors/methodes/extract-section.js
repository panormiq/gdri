/**
 * Méthode d'extraction : Section
 * Fichier : backend/modules/agent-documentaire/extractors/methodes/extract-section.js
 * 
 * Fonction : Extrait les sections (chapitres/sous-chapitres) du document
 * Utilise word-tags-config.js pour savoir comment traiter chaque balise
 */

const WordParser = require('../word-parser');
const { getTagConfig } = require('../word-tags-config');
const ExtractToc = require('./extract-toc'); // Import here for isAnnexesSectionTitle
const StyleHierarchy = require('../style-hierarchy');

class ExtractSection {
  /**
   * Extrait les sections depuis le XML Word
   * @param {Object} documentObj - Objet XML parsé du document
   * @param {Array} images - Liste des images extraites
   * @param {Object} relationshipsObj - Relations du document (pour les images)
   * @param {Object} documentStyles - Styles généraux du document (depuis word/styles.xml)
   * @param {Array} toc - Table des matières (pour identifier le premier titre et créer la section introduction)
   * @returns {Promise<Object>} { sections }
   */
  static async extract(documentObj, images, relationshipsObj = null, documentStyles = {}, toc = [], styleHierarchy = null) {
    // TODO: Implémenter l'extraction des sections
    // - Détecter les titres (headings) pour créer les sections
    // - Grouper le contenu sous chaque section
    // - Gérer la hiérarchie (sections et sous-sections)
    // - Détecter les annexes
    
    const sections = [];
    
    // ÉTAPE 1 : Récupérer le corps du document avec WordParser
    const body = WordParser.getBody(documentObj);
    if (!body) {
      console.warn('⚠️  Corps du document (w:body) non trouvé');
      return { sections };
    }
    
    // ÉTAPE 2 : Identifier le premier titre du TOC (pour créer la section introduction)
    const firstTocTitle = this.getFirstTocTitle(toc);
    let introductionContent = [];
    let foundFirstTitle = false;
    
    // ÉTAPE 3 : Récupérer tous les éléments de premier niveau (w:p, w:tbl, etc.)
    const topLevelElements = WordParser.getTopLevelElements(documentObj);
    console.log(`📄 ${topLevelElements.length} éléments de premier niveau trouvés`);
    
    // ÉTAPE 4 : Parcourir chaque élément et utiliser word-tags-config pour identifier le type
    let currentSection = null;
    let sectionOrder = 0;
    const sectionStack = []; // Pile pour gérer la hiérarchie des sections
    let introductionInserted = false;
    let sommaireSection = null;
    
    const pushIntroductionSection = () => {
      if (!introductionInserted && introductionContent.length > 0) {
        const introSection = {
          id: `intro_${Date.now()}`,
          type: 'introduction',
          title: 'Introduction / Présentation',
          level: 0,
          order: 0,
          isAnnex: false,
          content: introductionContent.splice(0),
          children: [],
          showInToc: false
        };
        sections.unshift(introSection);
        introductionInserted = true;
        console.log(`📝 Section introduction créée avec ${introSection.content.length} éléments`);
      }
    };
    
    const trimStackForLevel = (targetLevel) => {
      while (sectionStack.length > 0) {
        const last = sectionStack[sectionStack.length - 1];
        if (last.isSommaire) {
          sectionStack.pop();
          continue;
        }
        if (last.level >= targetLevel) {
          sectionStack.pop();
          continue;
        }
        break;
      }
    };
    
    const ensureCurrentSection = () => {
      if (currentSection) {
        return currentSection;
      }
      const fallback = {
        id: `sec_default_${Date.now()}`,
        type: 'section',
        level: 1,
        title: 'Contenu sans titre',
        order: sectionOrder++,
        isAnnex: false,
        content: [],
        children: [],
        linkedAnnexes: []
      };
      sections.push(fallback);
      sectionStack.push(fallback);
      currentSection = fallback;
      return fallback;
    };
    
    for (const { tag, element, config } of topLevelElements) {
      let styleId = null;
      let headingLevel = null;
      let isHeading = false;
      let isTocParagraph = false;
      let paragraphText = null;
      let numberingInfo = null;
      
      if (tag === 'w:p' && styleHierarchy) {
        styleId = WordParser.getParagraphStyle(element);
        const styleInfo = this.getHeadingInfoFromStyle(styleId, styleHierarchy);
        if (styleInfo?.isToc) {
          if (!sommaireSection) {
            // Vérifier si le paragraphe du sommaire a un saut de page
            const ExtractParagraph = require('./extract-paragraph');
            const hasPageBreak = ExtractParagraph.hasPageBreak(element);
            
            sommaireSection = {
              id: `sommaire_${Date.now()}`,
              type: 'section',
              title: 'Sommaire',
              level: 0,
              order: sectionOrder++,
              isAnnex: false,
              isSommaire: true,
              content: [],
              children: [],
              showInToc: false,
              hasPageBreak: hasPageBreak // Ajouter l'indicateur de saut de page
            };
            sections.push(sommaireSection);
          }
          currentSection = sommaireSection;
          sectionStack.length = 0;
          sectionStack.push(sommaireSection);
          isTocParagraph = true;
        } else if (styleInfo?.level) {
          headingLevel = styleInfo.level;
          isHeading = true;
        }
      }
      
      if (tag === 'w:p') {
        paragraphText = WordParser.extractText(element);
        if (paragraphText) {
          numberingInfo = ExtractToc.extractNumbering(paragraphText);
        }
      }
      
      const method = config?.getMethod ? config.getMethod() : config?.method;
      if (!config || (!method && !isHeading)) {
          continue;
        }
        
        try {
        if (isHeading) {
          const headingExtraction = config.type === 'heading' && method
            ? await method(element, documentStyles)
            : null;
          const headingText = headingExtraction?.text || paragraphText || WordParser.extractText(element);
          const numbering = numberingInfo || (headingText ? ExtractToc.extractNumbering(headingText) : null);
          let level = headingLevel;
          
          if (!level && numbering?.full) {
            level = this.getLevelFromNumbering(numbering.full);
          }
          if (!level) {
            level = 1;
          }
          
          const normalizedTitle = (headingText || '').trim().toLowerCase();
          if (normalizedTitle === 'sommaire') {
            if (!sommaireSection) {
              // Vérifier si le paragraphe du titre Sommaire a un saut de page
              const ExtractParagraph = require('./extract-paragraph');
              const hasPageBreak = ExtractParagraph.hasPageBreak(element);
              
              sommaireSection = {
                id: `sommaire_${Date.now()}`,
                type: 'section',
                title: headingText || 'Sommaire',
                level: 0,
                order: sectionOrder++,
                isAnnex: false,
                isSommaire: true,
                content: [],
                children: [],
                showInToc: false,
                hasPageBreak: hasPageBreak // Ajouter l'indicateur de saut de page
              };
              sections.push(sommaireSection);
            }
            currentSection = sommaireSection;
            sectionStack.length = 0;
            sectionStack.push(sommaireSection);
            continue;
          }
          
          if (!foundFirstTitle && introductionContent.length > 0) {
            pushIntroductionSection();
          }
          
              foundFirstTitle = true;
          trimStackForLevel(level);
          
          // Déterminer le titre de la section
          const sectionTitle = numbering?.text || headingText || '';
          
          // Ne créer une section que si elle a un vrai titre (pas vide)
          if (!sectionTitle || sectionTitle.trim() === '') {
            console.log(`⚠️  Titre vide ignoré (niveau ${level})`);
            continue;
          }
          
          const sectionNumbering = numbering?.full || null;
          const isAnnex = this.isAnnexSection(sectionTitle, level, sectionStack);
          
          // Vérifier si le paragraphe du titre a un saut de page
          const ExtractParagraph = require('./extract-paragraph');
          const hasPageBreak = ExtractParagraph.hasPageBreak(element);
          
            const newSection = {
              id: `sec_${Date.now()}_${sectionOrder++}`,
              type: 'section',
            level,
            title: sectionTitle,
            numbering: sectionNumbering,
              order: sectionOrder,
            isAnnex,
              content: [],
              children: [],
            linkedAnnexes: []
            };
          
          // Ajouter l'indicateur de saut de page si présent
          if (hasPageBreak) {
            newSection.hasPageBreak = true;
          }
            
            if (sectionStack.length === 0) {
              sections.push(newSection);
            } else {
            const parent = sectionStack[sectionStack.length - 1];
            parent.children.push(newSection);
            }
            
            sectionStack.push(newSection);
            currentSection = newSection;
            
            console.log(`📑 Section créée : "${newSection.title}" (niveau ${level})`);
        } else if (config.type === 'paragraph' || config.type === 'image' || config.type === 'table') {
              let extracted;
              if (config.type === 'paragraph') {
                extracted = await method(element, documentStyles);
              } else if (config.type === 'image') {
                extracted = await method(element, images, relationshipsObj);
              } else if (config.type === 'table') {
                extracted = await method(element);
              }
              
          if (!extracted) {
            continue;
          }
          
          if (isTocParagraph) {
            sommaireSection?.content.push(extracted);
            continue;
          }
          
          if (!foundFirstTitle && !currentSection) {
            introductionContent.push(extracted);
            continue;
          }
          
          const targetSection = ensureCurrentSection();
          targetSection.content.push(extracted);
        }
      } catch (error) {
        console.error(`❌ Erreur lors de l'extraction de ${tag}:`, error.message);
      }
    }
    
    if (introductionContent.length > 0 && !introductionInserted) {
      pushIntroductionSection();
    }
    
    console.log(`✅ Extraction terminée : ${sections.length} sections`);
    
    return {
      sections
      // Note: Le TOC est extrait séparément par extract-toc.js
    };
  }

  /**
   * Récupère le premier titre du TOC (pour identifier où commence le contenu réel)
   * @param {Array} toc - Table des matières
   * @returns {Object|null} Premier titre du TOC ou null
   */
  static getFirstTocTitle(toc) {
    if (!toc || toc.length === 0) {
      return null;
    }
    
    // Ignorer le séparateur et trouver le premier vrai titre
    for (const entry of toc) {
      if (entry.type !== 'separator' && entry.title && !this.isAnnexesSectionTitle(entry.title)) {
        return entry;
      }
    }
    
    return null;
  }

  /**
   * Vérifie si un titre correspond à une entrée du TOC
   * @param {string} headingText - Texte du titre
   * @param {Object} tocEntry - Entrée du TOC
   * @returns {boolean} True si ça correspond
   */
  static matchesTocTitle(headingText, tocEntry) {
    if (!headingText || !tocEntry || !tocEntry.title) {
      return false;
    }
    
    // Comparaison simple (peut être améliorée)
    const headingClean = headingText.trim();
    const tocClean = tocEntry.title.trim();
    
    return headingClean === tocClean || 
           headingClean.includes(tocClean) || 
           tocClean.includes(headingClean);
  }

  /**
   * Détecte si une section est une annexe
   * @param {string} title - Titre de la section
   * @param {number} level - Niveau de la section
   * @param {Array} sectionStack - Pile des sections (pour vérifier le parent)
   * @returns {boolean} True si c'est une annexe
   */
  static isAnnexSection(title, level, sectionStack) {
    // Vérifier si c'est la section "ANNEXES" elle-même
    if (this.isAnnexesSectionTitle(title) && level === 1) {
      return false; // "ANNEXES" n'est pas une annexe, c'est la section parente
    }
    
    // Vérifier si le parent est "ANNEXES"
    if (sectionStack.length > 0) {
      const parent = sectionStack[sectionStack.length - 1];
      if (this.isAnnexesSectionTitle(parent.title)) {
        return true; // Enfant de "ANNEXES" = annexe
      }
    }
    
    // Sinon, vérifier si le titre contient "ANNEXE" (pour les annexes individuelles)
    const ExtractToc = require('./extract-toc');
    return ExtractToc.isAnnexTitle && ExtractToc.isAnnexTitle(title);
  }

  /**
   * Vérifie si un titre est la section "ANNEXES"
   * @param {string} title - Titre à vérifier
   * @returns {boolean} True si c'est "ANNEXES"
   */
  static isAnnexesSectionTitle(title) {
    if (!title) return false;
    const upperTitle = title.toUpperCase().trim();
    return upperTitle === 'ANNEXES' || 
           upperTitle === 'ANNEXE' ||
           upperTitle === 'APPENDICES' ||
           upperTitle === 'APPENDIX';
  }

  /**
   * Calcule la similarité entre deux textes (0 à 1)
   * Utilise l'algorithme de Jaro-Winkler simplifié
   * @param {string} text1 - Premier texte
   * @param {string} text2 - Deuxième texte
   * @returns {number} Similarité entre 0 et 1
   */
  static calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    if (text1 === text2) return 1;
    
    // Algorithme simple : compter les caractères communs
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;
    
    if (longer.length === 0) return 1;
    
    // Compter les caractères communs (dans l'ordre)
    let matches = 0;
    let j = 0;
    for (let i = 0; i < shorter.length && j < longer.length; i++) {
      if (shorter[i] === longer[j]) {
        matches++;
        j++;
      } else {
        // Chercher le caractère dans la suite
        const found = longer.indexOf(shorter[i], j);
        if (found !== -1) {
          matches++;
          j = found + 1;
        }
      }
    }
    
    return matches / longer.length;
  }

  /**
   * Retourne les informations de niveau pour un style donné
   */
  static getHeadingInfoFromStyle(styleId, styleHierarchy) {
    if (!styleId) {
      return { level: null, isToc: false };
    }
    // Détecter les styles TMX (TM1, TM2, etc.) - styles du sommaire Word
    const normalized = styleId.toLowerCase();
    if (normalized.startsWith('tm') || normalized.match(/^tm\d+$/)) {
      return { level: 0, isToc: true };
    }
    // Utiliser la hiérarchie de styles pour obtenir le niveau
    const level = styleHierarchy ? StyleHierarchy.getHeadingLevel(styleId, styleHierarchy) : null;
    return { level, isToc: false };
  }

  /**
   * Déduit le niveau depuis une numérotation textuelle (ex: I., II.1., 1.2.3.)
   */
  static getLevelFromNumbering(numbering) {
    if (!numbering || typeof numbering !== 'string') {
      return null;
    }
    const trimmed = numbering.trim();
    if (!trimmed) {
      return null;
    }
    if (/^[IVXLCM]+\./i.test(trimmed)) {
      return 1;
    }
    const segments = trimmed
      .split('.')
      .map(part => part.trim())
      .filter(Boolean);
    if (segments.length > 0) {
      return segments.length;
    }
    return null;
  }
}

module.exports = ExtractSection;

