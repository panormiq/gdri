/**
 * Agent Documentaire - Frontend
 * Gestion des vues et affichage des sections
 */

(function () {
  const editorRoot = document.querySelector('.doc-editor');
  if (!editorRoot) {
    return;
  }

  const documentId = editorRoot.dataset.documentId || '';
  const apiBase = window.API_BASE_URL || '';

  let documentJson = null;
  let sectionsTree = [];
  let currentCardParent = null; // Pour la navigation dans les cards

  /**
   * Stocke les marges de page Word pour les appliquer aux paragraphes
   */
  let pageMargins = { top: 70.85, right: 70.85, bottom: 70.85, left: 70.85 }; // Valeurs par défaut (2.5cm)
  
  function applyPageMargins(margins) {
    if (margins) {
      pageMargins = margins;
    }
  }

  /**
   * Charge le document depuis l'API
   */
  async function loadDocument() {
    if (!documentId || !apiBase) {
      return;
    }

    const url = `${apiBase}/agent-documentaire/document/${documentId}`;

    try {
      const response = await fetch(url);

      const payload = await response.json();
      
      if (!payload.success) {
        throw new Error(payload.error || 'Erreur API');
      }

      documentJson = payload.data.json_content;
      
      sectionsTree = Array.isArray(documentJson.sections) ? documentJson.sections : [];

      // Appliquer les marges de page au conteneur de contenu
      applyPageMargins(documentJson.pageMargins);

      // Recalculer la numérotation avec les formats Word
      recalculateNumbering();

      renderAll();
    } catch (error) {
      console.error('❌ Erreur chargement document:', error);
      console.error('Stack trace:', error.stack);
    }
  }

  /**
   * Rend toutes les vues
   */
  function renderAll() {
    renderSommaire();
    renderContent();
    renderCards();
  }

  /**
   * Convertit les styles Word en CSS inline
   * @param {Object} styles - Styles extraits
   * @param {boolean} isTitle - Si true, c'est un titre de section (gestion spéciale des marges avec backgroundColor)
   */
  function stylesToCSS(styles, isTitle = false) {
    if (!styles || typeof styles !== 'object') return '';
    
    const cssProps = [];
    
    // Propriétés de run (texte)
    if (styles.fontFamily) {
      cssProps.push(`font-family: '${styles.fontFamily}'`);
    }
    if (styles.fontSize) {
      cssProps.push(`font-size: ${styles.fontSize}pt`);
    }
    if (styles.color) {
      cssProps.push(`color: ${styles.color}`);
    }
    if (styles.bold) {
      cssProps.push('font-weight: bold');
    }
    if (styles.italic) {
      cssProps.push('font-style: italic');
    }
    if (styles.underline) {
      cssProps.push('text-decoration: underline');
    }
    if (styles.caps) {
      cssProps.push('text-transform: uppercase');
    }
    
    // Propriétés de paragraphe
    if (styles.alignment) {
      cssProps.push(`text-align: ${styles.alignment}`);
    }
    
    // Couleur de fond du paragraphe (toute la largeur)
    if (styles.backgroundColor) {
      cssProps.push(`background-color: ${styles.backgroundColor}`);
    }
    
    // Couleur de fond du run (texte uniquement)
    if (styles.runBackgroundColor && !styles.backgroundColor) {
      cssProps.push(`background-color: ${styles.runBackgroundColor}`);
    }
    
    // Espacement
    if (styles.spacing) {
      if (styles.spacing.before) {
        cssProps.push(`margin-top: ${styles.spacing.before}pt`);
      }
      if (styles.spacing.after) {
        cssProps.push(`margin-bottom: ${styles.spacing.after}pt`);
      }
      // Line-height : ne pas appliquer aux titres (ils utilisent leur propre line-height CSS)
      // Appliquer uniquement aux paragraphes
      if (!isTitle && styles.spacing && styles.spacing.line) {
        // Appliquer selon le type : fixe (en pt) ou multiple (sans unité)
        if (styles.spacing.lineType === 'fixed') {
          // Valeur fixe en points : ex. 30pt
          cssProps.push(`line-height: ${styles.spacing.line}pt`);
        } else {
          // Multiple relatif : ex. 1.5 (sans unité)
          cssProps.push(`line-height: ${styles.spacing.line}`);
        }
      }
    }
    
    // Indentation + Marges de page Word
    if (styles.indentation) {
      if (styles.backgroundColor) {
        // Éléments avec fond de couleur (titre ou paragraphe)
        const leftIndent = styles.indentation.left || 0;
        const rightIndent = styles.indentation.right || 0;
        
        // TITRES : Word ignore la marge négative à gauche (réserve 2.5cm pour numérotation)
        // PARAGRAPHES : Word applique les marges négatives des deux côtés (fond pleine largeur)
        if (isTitle) {
          // Titre avec fond : marge gauche normale (2.5cm) + marge droite négative
          cssProps.push(`margin-left: ${pageMargins.left}pt`);
          if (rightIndent < 0) {
            cssProps.push(`margin-right: ${rightIndent}pt`);
          }
          // Pas de padding codé en dur - extrait du Word si présent
        } else {
          // Paragraphe avec fond : appliquer les marges négatives des deux côtés
          if (leftIndent < 0) {
            cssProps.push(`margin-left: ${leftIndent}pt`);
          }
          if (rightIndent < 0) {
            cssProps.push(`margin-right: ${rightIndent}pt`);
          }
          // Pas de padding codé en dur - extrait du Word si présent
        }
        
        if (styles.indentation.firstLine) {
          cssProps.push(`text-indent: ${styles.indentation.firstLine}pt`);
        }
      } else {
        // Comportement normal : ajouter les marges de page aux marges de paragraphe
        if (styles.indentation.left !== undefined) {
          const totalLeft = styles.indentation.left + pageMargins.left;
          cssProps.push(`margin-left: ${totalLeft}pt`);
        } else {
          // Pas de marge de paragraphe, appliquer seulement la marge de page
          cssProps.push(`margin-left: ${pageMargins.left}pt`);
        }
        
        if (styles.indentation.right !== undefined) {
          const totalRight = styles.indentation.right + pageMargins.right;
          cssProps.push(`margin-right: ${totalRight}pt`);
        } else {
          // Pas de marge de paragraphe, appliquer seulement la marge de page
          cssProps.push(`margin-right: ${pageMargins.right}pt`);
        }
        
        if (styles.indentation.firstLine) {
          cssProps.push(`text-indent: ${styles.indentation.firstLine}pt`);
        }
      }
    } else if (!styles.backgroundColor) {
      // Aucune indentation définie, appliquer les marges de page par défaut
      cssProps.push(`margin-left: ${pageMargins.left}pt`);
      cssProps.push(`margin-right: ${pageMargins.right}pt`);
    } else {
      // backgroundColor sans indentation : pas de padding codé en dur
      // Le fond s'étend jusqu'aux marges comme dans Word
    }
    
    return cssProps.length > 0 ? cssProps.join('; ') : '';
  }

  /**
   * Génère une section HTML récursive
   * @param {boolean} hideTitle - Si true, ne pas afficher le titre (pour la vue texte complète)
   */
  function generateSectionHTML(section, level = 1, hideTitle = false) {
    if (!section) return '';

    const sectionId = section.id || `section-${Date.now()}-${Math.random()}`;
    const title = section.title || '(Sans titre)';
    const numbering = section.numbering || '';
    const content = section.content || [];
    const children = section.children || [];
    const isIntroduction = section.type === 'introduction';

    let html = `<div id="${sectionId}" class="section level-${level}" data-section-id="${sectionId}">`;
    
    // Si la section a un saut de page, ajouter un séparateur avant le titre
    if (section.hasPageBreak) {
      html += `<div class="page-break"><span>Saut de page</span></div>`;
    }
    
    // Titre (ne pas afficher pour l'introduction dans la vue texte)
    if (!hideTitle && !isIntroduction) {
      const headingTag = `h${Math.min(level + 1, 6)}`;
      const displayTitle = numbering ? `${numbering} ${title}` : title;
      
      // Appliquer les styles du titre (couleur, fond, police, etc.)
      const titleStyles = section.titleStyles || {};
      const titleStyleAttr = stylesToCSS(titleStyles, true); // isTitle=true pour gestion spéciale des marges
      const titleStyleString = titleStyleAttr ? ` style="${titleStyleAttr}"` : '';
      
      html += `<${headingTag} class="section-title"${titleStyleString}>${displayTitle}</${headingTag}>`;
    }

    // Contenu (paragraphes, images, etc.)
    content.forEach(item => {
      if (item.type === 'paragraph') {
        // Si le paragraphe a un saut de page, ajouter un séparateur
        if (item.hasPageBreak) {
          html += `<div class="page-break"><span>Saut de page</span></div>`;
        }
        
        const text = item.text || '';
        const styles = item.styles || {};
        
        // Si le paragraphe est vide, afficher &nbsp; pour faciliter l'édition future
        const displayText = text.trim() === '' ? '&nbsp;' : text;
        
        // Gérer la couleur de fond : paragraphe vs run
        if (styles.runBackgroundColor && displayText !== '&nbsp;') {
          // Background de run : wrapper le texte dans un <span>
          const paragraphStyles = { ...styles };
          delete paragraphStyles.runBackgroundColor; // Retirer du paragraphe
          const paragraphStyleAttr = stylesToCSS(paragraphStyles);
          const paragraphStyleString = paragraphStyleAttr ? ` style="${paragraphStyleAttr}"` : '';
          
          html += `<p${paragraphStyleString}><span style="background-color: ${styles.runBackgroundColor}">${displayText}</span></p>`;
        } else {
          // Background de paragraphe (ou pas de background)
          // Pour les paragraphes vides, s'assurer que le background est visible
          const styleProps = [];
          const cssStyles = stylesToCSS(styles);
          if (cssStyles) {
            styleProps.push(cssStyles);
          }
          // Pour les paragraphes vides avec background, ajouter une hauteur minimum
          if (displayText === '&nbsp;' && styles.backgroundColor) {
            styleProps.push('min-height: 1em');
          }
          const styleString = styleProps.length > 0 ? ` style="${styleProps.join('; ')}"` : '';
          html += `<p${styleString}>${displayText}</p>`;
        }
      } else if (item.type === 'image') {
        const imageSrc = item.src || item.name || '';
        const alt = item.alt || 'Image';
        const width = item.width || '';
        const height = item.height || '';
        const position = item.position || {};
        const paragraphBgColor = item.paragraphBackgroundColor || '';
        const textAlign = item.textAlign || '';
        
        // Extraire juste le nom du fichier (si c'est un chemin complet)
        const imageName = imageSrc.includes('/') ? imageSrc.split('/').pop() : imageSrc;
        
        // Construire l'URL de l'image via l'API
        const imageUrl = imageName ? `${apiBase}/agent-documentaire/document/${documentId}/image/${imageName}` : '';
        
        // Construire les styles de l'image
        const imgStyleProps = [];
        if (width) imgStyleProps.push(`width: ${width}px`);
        if (height) imgStyleProps.push(`height: ${height}px`);
        
        // Border radius extrait du Word
        if (item.borderRadius !== null && item.borderRadius !== undefined) {
          imgStyleProps.push(`border-radius: ${item.borderRadius}pt`);
        }
        
        // Ombre extraite du Word
        if (item.shadow && item.shadow.enabled) {
          const shadow = item.shadow;
          const offsetX = shadow.offsetX || 0;
          const offsetY = shadow.offsetY || 0;
          const blur = shadow.blur || 0;
          const color = shadow.color || 'rgba(0, 0, 0, 0.3)';
          
          // Pour les ombres internes, utiliser inset
          if (shadow.type === 'inner') {
            imgStyleProps.push(`box-shadow: inset ${offsetX}pt ${offsetY}pt ${blur}pt ${color}`);
          } else {
            imgStyleProps.push(`box-shadow: ${offsetX}pt ${offsetY}pt ${blur}pt ${color}`);
          }
        }
        
        // Position absolue SEULEMENT pour les images anchor (isAbsolute = true)
        if (position.isAbsolute === true) {
          imgStyleProps.push('position: absolute');
          if (position.x !== undefined && position.x !== 0) imgStyleProps.push(`left: ${position.x}px`);
          if (position.y !== undefined && position.y !== 0) imgStyleProps.push(`top: ${position.y}px`);
        }
        
        // Gestion du centrage et des marges
        if (paragraphBgColor) {
          // Avec fond de paragraphe: pas de marges (pour éviter les bandes blanches)
          imgStyleProps.push('margin: 0');
          if (textAlign === 'center') {
            // Pour centrer avec text-align, l'image doit être inline-block
            imgStyleProps.push('display: inline-block');
            imgStyleProps.push('vertical-align: top'); // Éviter l'espace en bas
          } else {
            imgStyleProps.push('display: block');
          }
        } else {
          // Sans fond: comportement normal avec marges de page
          if (textAlign === 'center') {
            imgStyleProps.push('display: block');
            imgStyleProps.push('margin-left: auto');
            imgStyleProps.push('margin-right: auto');
          } else {
            // Appliquer les marges de page directement sur l'image si pas de conteneur
            imgStyleProps.push(`margin-left: ${pageMargins.left}pt`);
            imgStyleProps.push(`margin-right: ${pageMargins.right}pt`);
          }
        }
        
        const imgStyleAttr = imgStyleProps.length > 0 ? ` style="${imgStyleProps.join('; ')}"` : '';
        
        // Construire les styles du conteneur (pour background et alignement)
        const containerStyles = [];
        if (paragraphBgColor) {
          containerStyles.push(`background-color: ${paragraphBgColor}`);
          containerStyles.push('padding: 0'); // Pas de padding pour éviter les espaces blancs
          containerStyles.push('margin: 0'); // Pas de margin pour coller au contenu
        } else {
          // Pas de fond de paragraphe : appliquer les marges de page
          containerStyles.push(`margin-left: ${pageMargins.left}pt`);
          containerStyles.push(`margin-right: ${pageMargins.right}pt`);
        }
        if (textAlign) containerStyles.push(`text-align: ${textAlign}`);
        
        // Si l'image a des propriétés de paragraphe, l'envelopper dans un div
        if (imageUrl) {
          // Ajouter un attribut data pour la transparence si nécessaire
          const colorToTransparent = item.colorToTransparent || '';
          const transparencyAttr = colorToTransparent ? ` data-transparent-color="${colorToTransparent}"` : '';
          
          if (containerStyles.length > 0) {
            html += `<div style="${containerStyles.join('; ')}">`;
            html += `<img src="${imageUrl}" alt="${alt}"${imgStyleAttr}${transparencyAttr} class="needs-transparency-processing" />`;
            html += `</div>`;
          } else {
            html += `<img src="${imageUrl}" alt="${alt}"${imgStyleAttr}${transparencyAttr} class="needs-transparency-processing" />`;
          }
        }
      }
    });

    // Enfants récursifs
    children.forEach(child => {
      html += generateSectionHTML(child, level + 1, hideTitle);
    });

    html += '</div>';
    return html;
  }

  /**
   * Génère le HTML du sommaire récursivement jusqu'au niveau 3
   * NE GÉNÈRE QUE LES TITRES - pas de contenu
   */
  function generateSommaireHTML(section, maxLevel = 3) {
    if (!section) return '';
    
    const sectionId = section.id || '';
    const title = section.title || '(Sans titre)';
    const numbering = section.numbering || '';
    const level = section.level || 1;
    const children = section.children || [];
    
    // Ne pas afficher si niveau > maxLevel
    if (level > maxLevel) return '';

    // Génération HTML SIMPLIFIÉE - UNIQUEMENT le titre, pas de contenu + draggable
    let html = `<div class="section level-${level} draggable-section" 
                     data-section-id="${sectionId}" 
                     data-level="${level}"
                     draggable="true">`;
    const displayTitle = numbering ? `${numbering} ${title}` : title;
    html += `<div class="section-title">${displayTitle}</div>`;
    
    // Ajouter récursivement les enfants
    if (children && children.length > 0) {
      children.forEach(child => {
        html += generateSommaireHTML(child, maxLevel);
      });
    }
    
    html += '</div>';
    return html;
  }

  /**
   * Rend le sommaire (colonne 1 haut) - titres uniquement jusqu'au niveau 3
   */
  function renderSommaire() {
    const sommaireList = document.querySelector('[data-sommaire-list]');
    const annexesList = document.querySelector('[data-annexes-list]');
    
    if (!sommaireList) return;

    let sommaireHTML = '';
    let annexesHTML = '';

    sectionsTree.forEach(section => {
      // Détecter si c'est une section "Annexes"
      const titleLower = (section.title || '').toLowerCase().trim();
      const isAnnexesSection = titleLower === 'annexes' || titleLower === 'annexe';

      if (isAnnexesSection) {
        // Placer les enfants de la section Annexes dans la partie annexes (jusqu'au niveau 3)
        if (section.children && section.children.length > 0) {
          section.children.forEach(child => {
            annexesHTML += generateSommaireHTML(child, 3);
          });
        }
      } else {
        // Section normale : ajouter au sommaire (jusqu'au niveau 3)
        sommaireHTML += generateSommaireHTML(section, 3);
      }
    });

    sommaireList.innerHTML = sommaireHTML || '<p class="text-muted">Aucune section</p>';
    
    if (annexesList) {
      annexesList.innerHTML = annexesHTML || '<p class="text-muted">Aucune annexe</p>';
    }

    // Attacher les événements de clic pour la navigation
    attachSommaireClickEvents();
    
    // Initialiser le drag & drop
    initDragAndDrop();
    
    // Initialiser le double-clic pour éditer
    initSectionDoubleClick();
  }

  /**
   * Attache les événements de clic sur les titres du sommaire
   * pour scroller vers la section correspondante dans la colonne 2
   */
  function attachSommaireClickEvents() {
    const sommaireList = document.querySelector('[data-sommaire-list]');
    const annexesList = document.querySelector('[data-annexes-list]');
    const contentArea = document.querySelector('[data-content-area]');
    const contentPanel = contentArea?.closest('.doc-panel__body');
    
    if (!contentArea || !contentPanel) return;

    // Fonction pour gérer le clic sur un titre
    const handleTitleClick = (event) => {
      const titleElement = event.target.closest('.section-title');
      if (!titleElement) return;

      const sectionDiv = titleElement.closest('.section');
      if (!sectionDiv || !sectionDiv.dataset.sectionId) return;

      const sectionId = sectionDiv.dataset.sectionId;
      
      // Trouver la section correspondante dans la colonne 2
      const targetSection = contentArea.querySelector(`.section[data-section-id="${sectionId}"]`);
      
      if (targetSection) {
        // Scroller vers la section dans la colonne 2
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Optionnel : ajouter un effet visuel temporaire
        targetSection.style.transition = 'background-color 0.3s';
        targetSection.style.backgroundColor = '#e3f2fd';
        setTimeout(() => {
          targetSection.style.backgroundColor = '';
        }, 1000);
      }
    };

    // Attacher les événements sur le sommaire
    if (sommaireList) {
      sommaireList.addEventListener('click', handleTitleClick);
    }

    // Attacher les événements sur les annexes
    if (annexesList) {
      annexesList.addEventListener('click', handleTitleClick);
    }
  }

  /**
   * Variables globales pour le drag & drop
   */
  let draggedElement = null;
  let draggedSection = null;

  /**
   * Initialise le drag & drop sur le sommaire
   */
  function initDragAndDrop() {
    const sommaireList = document.querySelector('[data-sommaire-list]');
    if (!sommaireList) return;

    // Retirer les événements existants pour éviter les doublons
    sommaireList.removeEventListener('dragstart', handleDragStart);
    sommaireList.removeEventListener('dragover', handleDragOver);
    sommaireList.removeEventListener('drop', handleDrop);
    sommaireList.removeEventListener('dragend', handleDragEnd);
    sommaireList.removeEventListener('dragenter', handleDragEnter);
    sommaireList.removeEventListener('dragleave', handleDragLeave);

    // Ajouter les événements (délégation)
    sommaireList.addEventListener('dragstart', handleDragStart);
    sommaireList.addEventListener('dragover', handleDragOver);
    sommaireList.addEventListener('drop', handleDrop);
    sommaireList.addEventListener('dragend', handleDragEnd);
    sommaireList.addEventListener('dragenter', handleDragEnter);
    sommaireList.addEventListener('dragleave', handleDragLeave);
  }

  /**
   * Gestion du début du drag
   */
  function handleDragStart(e) {
    const section = e.target.closest('.draggable-section');
    if (!section) return;

    draggedElement = section;
    draggedSection = findSectionById(section.dataset.sectionId, sectionsTree);
    
    section.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', section.innerHTML);
  }

  /**
   * Gestion du dragover (permet le drop)
   */
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const target = e.target.closest('.draggable-section');
    if (!target || target === draggedElement) return;

    // Indicateur visuel: ligne au-dessus ou en-dessous
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    
    if (e.clientY < midpoint) {
      target.classList.add('drop-above');
      target.classList.remove('drop-below', 'drop-inside');
      } else {
      target.classList.add('drop-below');
      target.classList.remove('drop-above', 'drop-inside');
    }
  }

  /**
   * Gestion du dragenter
   */
  function handleDragEnter(e) {
    const target = e.target.closest('.draggable-section');
    if (!target || target === draggedElement) return;
    target.classList.add('drag-over');
  }

  /**
   * Gestion du dragleave
   */
  function handleDragLeave(e) {
    const target = e.target.closest('.draggable-section');
    if (!target) return;
    target.classList.remove('drag-over', 'drop-above', 'drop-below', 'drop-inside');
  }

  /**
   * Gestion du drop
   */
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target.closest('.draggable-section');
    if (!target || target === draggedElement) {
      cleanupDragClasses();
        return;
      }

    const targetSection = findSectionById(target.dataset.sectionId, sectionsTree);
    if (!targetSection || !draggedSection) {
      cleanupDragClasses();
      return;
    }

    // Déterminer la position du drop
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const dropPosition = e.clientY < midpoint ? 'before' : 'after';

    // Réorganiser la structure
    reorganizeSections(draggedSection, targetSection, dropPosition);

    // Recalculer la numérotation
    recalculateNumbering();

    // Re-render tout
    renderSommaire();
    renderContent();

    cleanupDragClasses();
  }

  /**
   * Gestion de la fin du drag
   */
  function handleDragEnd(e) {
    cleanupDragClasses();
    draggedElement = null;
    draggedSection = null;
  }

  /**
   * Nettoie les classes CSS du drag
   */
  function cleanupDragClasses() {
    const allSections = document.querySelectorAll('.draggable-section');
    allSections.forEach(section => {
      section.classList.remove('dragging', 'drag-over', 'drop-above', 'drop-below', 'drop-inside');
    });
  }

  /**
   * Réorganise les sections dans sectionsTree
   */
  function reorganizeSections(draggedSection, targetSection, position) {
    // 1. Retirer draggedSection de son parent actuel
    removeSectionFromTree(draggedSection);

    // 2. Trouver le parent de targetSection
    const targetParent = findParentSection(targetSection.id, sectionsTree);
    const targetArray = targetParent ? targetParent.children : sectionsTree;
    
    // 3. Trouver l'index de targetSection
    const targetIndex = targetArray.findIndex(s => s.id === targetSection.id);
    
    if (targetIndex === -1) return;

    // 4. Insérer draggedSection à la bonne position
    if (position === 'before') {
      targetArray.splice(targetIndex, 0, draggedSection);
    } else { // after
      targetArray.splice(targetIndex + 1, 0, draggedSection);
    }

    // 5. Mettre à jour le niveau de draggedSection
    draggedSection.level = targetSection.level;
    updateChildrenLevels(draggedSection);
  }

  /**
   * Retire une section de l'arbre
   */
  function removeSectionFromTree(section) {
    const parent = findParentSection(section.id, sectionsTree);
    const array = parent ? parent.children : sectionsTree;
    const index = array.findIndex(s => s.id === section.id);
    
    if (index !== -1) {
      array.splice(index, 1);
    }
  }

  /**
   * Trouve le parent d'une section
   */
  function findParentSection(sectionId, sections, parent = null) {
    for (const section of sections) {
      if (section.id === sectionId) {
        return parent;
      }
      if (section.children && section.children.length > 0) {
        const found = findParentSection(sectionId, section.children, section);
        if (found !== null) return found;
      }
    }
    return null;
  }

  /**
   * Met à jour les niveaux des enfants récursivement
   */
  function updateChildrenLevels(section) {
    if (!section.children || section.children.length === 0) return;
    
    section.children.forEach(child => {
      child.level = section.level + 1;
      updateChildrenLevels(child);
    });
  }

  /**
   * Formate un numéro selon le format Word (decimal, upperRoman, lowerRoman, etc.)
   * @param {number} num - Numéro à formater
   * @param {string} numFmt - Format Word (decimal, upperRoman, lowerRoman, upperLetter, lowerLetter)
   * @returns {string} Numéro formaté
   */
  function formatNumber(num, numFmt = 'decimal') {
    switch (numFmt) {
      case 'decimal':
        return num.toString();
      case 'upperRoman':
        return toRoman(num).toUpperCase();
      case 'lowerRoman':
        return toRoman(num).toLowerCase();
      case 'upperLetter':
        return toLetter(num - 1).toUpperCase();
      case 'lowerLetter':
        return toLetter(num - 1).toLowerCase();
      default:
        return num.toString();
    }
  }

  /**
   * Convertit un index en lettre (0=A, 1=B, etc.)
   * @param {number} index - Index (0-based)
   * @returns {string} Lettre
   */
  function toLetter(index) {
    let result = '';
    while (index >= 0) {
      result = String.fromCharCode(97 + (index % 26)) + result;
      index = Math.floor(index / 26) - 1;
    }
    return result;
  }

  /**
   * Génère la numérotation selon le format Word et les numéros de chaque niveau
   * @param {string} format - Format Word (ex: "%1.", "%1.%2.", etc.)
   * @param {Array<number>} levelNumbers - Numéros pour chaque niveau [niveau0, niveau1, niveau2, ...]
   * @param {Object} numberingFormats - Formats de numérotation extraits depuis Word
   * @returns {string} Numérotation générée (ex: "I.", "1.1.", etc.)
   */
  function generateNumbering(format, levelNumbers, numberingFormats) {
    if (!format || !numberingFormats) {
      // Fallback : utiliser le format simple
      return levelNumbers.map(n => n.toString()).join('.') + '.';
    }

    let result = format;
    
    // Dans Word, %1 = niveau 1, %2 = niveau 2, etc.
    // Mais levelNumbers est indexé à partir de 0 : [niveau0, niveau1, niveau2, ...]
    // Donc levelNumbers[0] = niveau 1, levelNumbers[1] = niveau 2, etc.
    
    // Trouver tous les placeholders dans le format (%1, %2, %3, etc.)
    const placeholderRegex = /%(\d+)/g;
    const placeholders = [];
    let match;
    while ((match = placeholderRegex.exec(format)) !== null) {
      const levelNum = parseInt(match[1]); // 1, 2, 3, etc. (niveau Word)
      const levelIndex = levelNum - 1; // 0, 1, 2, etc. (index dans levelNumbers)
      placeholders.push({
        placeholder: match[0], // "%1", "%2", etc.
        levelNum: levelNum, // 1, 2, 3, etc.
        levelIndex: levelIndex // 0, 1, 2, etc.
      });
    }
    
    // Remplacer chaque placeholder par le numéro formaté
    for (const placeholder of placeholders) {
      const { placeholder: placeholderStr, levelNum: placeholderLevelNum, levelIndex } = placeholder;
      
      // Dans Word, les placeholders dans w:lvlText sont relatifs au niveau actuel :
      // - %1 = niveau actuel (celui défini par w:ilvl)
      // - %2 = niveau parent (w:ilvl - 1)
      // - %3 = niveau grand-parent (w:ilvl - 2), etc.
      // 
      // Mais en réalité, Word utilise %1 pour le niveau actuel, %2 pour le niveau parent, etc.
      // Donc pour le niveau 0, %1 = niveau 0
      // Pour le niveau 1, %1 = niveau 1, %2 = niveau 0 (parent)
      
      // Le placeholderLevelNum (1, 2, 3, etc.) correspond au niveau Word
      // Mais levelNumbers est indexé à partir de 0 : [niveau0, niveau1, niveau2, ...]
      // Donc levelNumbers[0] = niveau 1, levelNumbers[1] = niveau 2, etc.
      
      // Calculer l'index réel dans levelNumbers
      // Si on est au niveau N et qu'on a un placeholder %M, alors :
      // - Si M = 1, on utilise le niveau actuel (levelNumbers[N])
      // - Si M = 2, on utilise le niveau parent (levelNumbers[N-1])
      // - etc.
      
      // Mais en fait, levelNumbers contient déjà tous les niveaux jusqu'au niveau actuel
      // levelNumbers[0] = niveau 0, levelNumbers[1] = niveau 1, etc.
      // Donc levelIndex = placeholderLevelNum - 1 est correct
      
      // Vérifier que le niveau existe dans levelNumbers
      if (levelIndex < 0 || levelIndex >= levelNumbers.length) {
        console.warn(`⚠️ Placeholder ${placeholderStr} référence un niveau ${levelIndex} qui n'existe pas (levelNumbers.length=${levelNumbers.length})`);
        continue;
      }
      
      const levelNum = levelNumbers[levelIndex];
      
      // Trouver le format pour ce niveau (utiliser levelIndex car c'est l'index dans numberingFormats)
      const levelFormat = numberingFormats.formats?.[levelIndex];
      const numFmt = levelFormat?.numFmt || 'decimal';
      
      // Formater le numéro
      const formattedNum = formatNumber(levelNum, numFmt);
      
      // Remplacer dans le format (échapper le placeholder pour éviter les problèmes avec les regex)
      const escapedPlaceholder = placeholderStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escapedPlaceholder, 'g'), formattedNum);
    }
    
    return result;
  }

  /**
   * Recalcule la numérotation de toutes les sections en utilisant les formats Word
   */
  function recalculateNumbering() {
    const numberingFormats = documentJson?.numberingFormats || { formats: {} };
    const levelCounters = {}; // Compteurs par niveau
    
    function processSection(section, parentLevelNumbers = []) {
      // Introduction : ignorer complètement
      if (section.type === 'introduction') {
        section.numbering = null;
        if (section.children) {
          section.children.forEach(child => processSection(child, []));
        }
        return;
      }
      
      // Sommaire : ignorer complètement (ne pas compter, ne pas afficher)
      const isSommaire = section.type === 'sommaire' || section.isSommaire;
      if (isSommaire) {
        section.numbering = null;
        if (section.children && section.children.length > 0) {
          section.children.forEach(child => {
            processSection(child, []);
          });
        }
        return;
      }
      
      const level = section.level || 1;
      const levelIndex = level - 1; // Convertir en index 0-based
      
      // Initialiser le compteur pour ce niveau si nécessaire
      if (!levelCounters[levelIndex]) {
        levelCounters[levelIndex] = 0;
      }
      
      // Incrémenter le compteur pour ce niveau
      levelCounters[levelIndex]++;
      
      // Réinitialiser les compteurs des niveaux inférieurs
      for (let i = levelIndex + 1; i < 10; i++) {
        levelCounters[i] = 0;
      }
      
      // Construire les numéros de chaque niveau jusqu'à ce niveau
      const levelNumbers = [];
      for (let i = 0; i <= levelIndex; i++) {
        levelNumbers.push(levelCounters[i] || 1);
      }
      
      // Trouver le format pour ce niveau
      const levelFormat = numberingFormats.formats?.[levelIndex];
      const format = levelFormat?.format || levelFormat?.text || '%1.';
      
      // Debug : log pour voir ce qui est utilisé
      if (level === 1) {
        console.log(`🔢 Section "${section.title}": level=${level}, levelIndex=${levelIndex}, format="${format}", levelFormat:`, levelFormat);
        console.log(`   levelNumbers:`, levelNumbers);
      }
      
      // Générer la numérotation
      section.numbering = generateNumbering(format, levelNumbers, numberingFormats);
      
      if (level === 1) {
        console.log(`   → numbering: "${section.numbering}"`);
      }
      
      // Traiter les enfants
      if (section.children && section.children.length > 0) {
        section.children.forEach(child => {
          processSection(child, levelNumbers);
        });
      }
    }
    
    // Réinitialiser tous les compteurs
    for (let i = 0; i < 10; i++) {
      levelCounters[i] = 0;
    }
    
    // Traiter toutes les sections
    sectionsTree.forEach(section => {
      processSection(section, []);
    });
  }

  /**
   * Convertit un nombre en chiffres romains
   */
  function toRoman(num) {
    const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const numerals = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
    let result = '';
    
    for (let i = 0; i < values.length; i++) {
      while (num >= values[i]) {
        result += numerals[i];
        num -= values[i];
      }
    }
    
    return result;
  }

  /**
   * Rend le contenu complet (colonne 2) - tout afficher
   */
  function renderContent() {
    const contentArea = document.querySelector('[data-content-area]');
    if (!contentArea) return;

    let html = '';
    sectionsTree.forEach(section => {
      html += generateSectionHTML(section, section.level || 1);
    });

    contentArea.innerHTML = html || '<p class="text-muted">Aucun contenu</p>';
    
    // Traiter les images qui ont besoin de transparence
    processImageTransparency();
  }
  
  /**
   * Traite les images pour appliquer la transparence sur une couleur spécifique
   */
  function processImageTransparency() {
    const images = document.querySelectorAll('img.needs-transparency-processing[data-transparent-color]');
    
    images.forEach(img => {
      const colorToTransparent = img.getAttribute('data-transparent-color');
      if (!colorToTransparent) return;
      
      // Attendre que l'image soit chargée
      if (img.complete) {
        applyTransparency(img, colorToTransparent);
      } else {
        img.onload = () => applyTransparency(img, colorToTransparent);
      }
    });
  }
  
  /**
   * Applique la transparence à une couleur spécifique d'une image avec Canvas
   */
  function applyTransparency(img, colorHex) {
    try {
      // Convertir la couleur hex en RGB
      const r = parseInt(colorHex.substr(1, 2), 16);
      const g = parseInt(colorHex.substr(3, 2), 16);
      const b = parseInt(colorHex.substr(5, 2), 16);
      
      // Créer un canvas avec les mêmes dimensions que l'image
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      
      // Dessiner l'image sur le canvas
      ctx.drawImage(img, 0, 0);
      
      // Récupérer les données de pixels
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Parcourir chaque pixel et rendre la couleur spécifique transparente
      // Tolérance de 5 pour tenir compte des variations de compression
      const tolerance = 5;
      for (let i = 0; i < data.length; i += 4) {
        const pixelR = data[i];
        const pixelG = data[i + 1];
        const pixelB = data[i + 2];
        
        // Si le pixel correspond à la couleur (avec tolérance), le rendre transparent
        if (Math.abs(pixelR - r) <= tolerance &&
            Math.abs(pixelG - g) <= tolerance &&
            Math.abs(pixelB - b) <= tolerance) {
          data[i + 3] = 0; // Alpha = 0 (transparent)
        }
      }
      
      // Remettre les données modifiées
      ctx.putImageData(imageData, 0, 0);
      
      // Remplacer l'image par la version avec transparence
      img.src = canvas.toDataURL('image/png');
      img.removeAttribute('data-transparent-color');
      img.classList.remove('needs-transparency-processing');
      
      console.log(`✅ Transparence appliquée pour la couleur ${colorHex}`);
    } catch (error) {
      console.error('Erreur lors de l\'application de la transparence:', error);
    }
  }

  /**
   * Rend les cards (vue card, colonne 1)
   */
  function renderCards(parentSection = null) {
    const cardsGrid = document.querySelector('[data-cards-grid]');
    const breadcrumb = document.querySelector('[data-cards-breadcrumb]');
    const backButton = document.querySelector('[data-cards-back]');
    
    if (!cardsGrid) return;

    // Sections à afficher
    const sectionsToDisplay = parentSection ? (parentSection.children || []) : sectionsTree;

    // Filtrer les annexes
    const filteredSections = sectionsToDisplay.filter(section => {
      const titleLower = (section.title || '').toLowerCase().trim();
      return titleLower !== 'annexes' && titleLower !== 'annexe' && titleLower !== 'sommaire';
    });

    // Générer les cards
    let html = '';
    filteredSections.forEach(section => {
      html += generateCardHTML(section);
    });

    cardsGrid.innerHTML = html || '<p class="text-muted">Aucune section</p>';

    // Breadcrumb
    if (breadcrumb) {
      if (parentSection) {
        breadcrumb.textContent = parentSection.title || 'Sous-sections';
      } else {
        breadcrumb.textContent = 'Niveau 1';
      }
    }

    // Bouton retour
    if (backButton) {
      backButton.style.display = parentSection ? 'inline-block' : 'none';
    }

    // Attacher les événements
    attachCardEvents();
  }

  /**
   * Génère le HTML d'une card
   */
  function generateCardHTML(section) {
    const sectionId = section.id || '';
    const title = section.title || '(Sans titre)';
    const numbering = section.numbering || '';
    const level = section.level || 1;
    const childrenCount = (section.children || []).length;

    return `
      <div class="section-card" data-card-id="${sectionId}">
        ${numbering ? `<div class="section-card__numbering">${numbering}</div>` : ''}
        <div class="section-card__title">${title}</div>
        <div class="section-card__meta">
          <span class="section-card__badge">📄 Niveau ${level}</span>
          ${childrenCount > 0 ? `<span class="section-card__badge">📂 ${childrenCount} sous-section${childrenCount > 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Attache les événements aux cards
   */
  function attachCardEvents() {
    const cards = document.querySelectorAll('.section-card');
    
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const cardId = card.dataset.cardId;
        const section = findSectionById(cardId, sectionsTree);
        
        if (section) {
          // Afficher les propriétés
          displayCardProperties(section);
          
          // Si a des enfants, naviguer
          if (section.children && section.children.length > 0) {
            currentCardParent = section;
            renderCards(section);
          }
        }
      });
    });
  }

  /**
   * Trouve une section par son ID
   */
  function findSectionById(id, sections) {
    for (const section of sections) {
      if (section.id === id) {
        return section;
      }
      if (section.children) {
        const found = findSectionById(id, section.children);
        if (found) return found;
      }
    }
        return null;
      }

  /**
   * Affiche les propriétés d'une card
   */
  function displayCardProperties(section) {
    const propertiesArea = document.querySelector('[data-card-properties]');
    if (!propertiesArea) return;

    const title = section.title || '(Sans titre)';
    const numbering = section.numbering || '–';
    const level = section.level || '–';
    const childrenCount = (section.children || []).length;

    const html = `
      <div class="property-item">
        <span class="property-label">Titre</span>
        <span class="property-value">${title}</span>
      </div>
      <div class="property-item">
        <span class="property-label">Numérotation</span>
        <span class="property-value">${numbering}</span>
      </div>
      <div class="property-item">
        <span class="property-label">Niveau</span>
        <span class="property-value">${level}</span>
      </div>
      <div class="property-item">
        <span class="property-label">Sous-sections</span>
        <span class="property-value">${childrenCount > 0 ? `${childrenCount} sous-section${childrenCount > 1 ? 's' : ''}` : 'Aucune'}</span>
      </div>
    `;

    propertiesArea.innerHTML = html;
  }

  /**
   * Gère le bouton retour dans la vue card
   */
  function initCardBackButton() {
    const backButton = document.querySelector('[data-cards-back]');
    if (!backButton) return;

    backButton.addEventListener('click', () => {
      currentCardParent = null;
      renderCards();
    });
  }

  /**
   * Initialise les onglets de vue (Vue texte / Vue card)
   */
  function initViewTabs() {
    const viewTabs = document.querySelectorAll('.view-tab');
    const viewContainers = document.querySelectorAll('.view-container');
    
    viewTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetView = tab.dataset.view;
        
        // Désactiver tous les onglets
        viewTabs.forEach((t) => t.classList.remove('is-active'));
        
        // Masquer toutes les vues
        viewContainers.forEach((container) => container.classList.remove('is-active'));
        
        // Activer l'onglet cliqué
        tab.classList.add('is-active');
        
        // Afficher la vue correspondante
        const targetContainer = document.querySelector(`.view-${targetView}`);
        if (targetContainer) {
          targetContainer.classList.add('is-active');
        }
      });
    });
  }

  /**
   * ===================================
   * MENU CONTEXTUEL + MODAL
   * ===================================
   */
  
  let currentEditSection = null;
  let contextMenuTarget = null;
  let contextMenuParent = null;

  /**
   * Initialise le menu contextuel (clic droit)
   */
  function initContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    const sommaireList = document.querySelector('[data-sommaire-list]');
    const annexesList = document.querySelector('[data-annexes-list]');

    // Clic droit sur le sommaire
    if (sommaireList) {
      sommaireList.addEventListener('contextmenu', handleContextMenu);
    }
    if (annexesList) {
      annexesList.addEventListener('contextmenu', handleContextMenu);
    }

    // Fermer le menu contextuel au clic ailleurs
    document.addEventListener('click', () => {
      if (contextMenu) {
        contextMenu.style.display = 'none';
      }
    });

    // Actions du menu contextuel
    const menuItems = document.querySelectorAll('.context-menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        handleContextMenuAction(action);
        if (contextMenu) {
          contextMenu.style.display = 'none';
        }
      });
    });
  }

  /**
   * Gère l'affichage du menu contextuel
   */
  function handleContextMenu(e) {
    e.preventDefault();
    
    const contextMenu = document.getElementById('contextMenu');
    if (!contextMenu) return;

    // Trouver la section ciblée
    const sectionDiv = e.target.closest('.draggable-section');
    contextMenuTarget = sectionDiv ? findSectionById(sectionDiv.dataset.sectionId, sectionsTree) : null;

    // Déterminer le parent pour "Ajouter une sous-section"
    contextMenuParent = contextMenuTarget;

    // Afficher/masquer les options selon le contexte
    const addChildItem = contextMenu.querySelector('[data-action="add-child"]');
    const editItem = contextMenu.querySelector('[data-action="edit"]');
    const deleteItem = contextMenu.querySelector('[data-action="delete"]');

    if (contextMenuTarget) {
      // Clic droit sur une section
      editItem.style.display = 'flex';
      deleteItem.style.display = 'flex';
      
      // Permettre d'ajouter un enfant seulement si niveau < 3
      if (contextMenuTarget.level < 3) {
        addChildItem.style.display = 'flex';
        addChildItem.querySelector('span').textContent = 
          `Ajouter une sous-section (niveau ${contextMenuTarget.level + 1})`;
      } else {
        addChildItem.style.display = 'none';
      }
    } else {
      // Clic droit dans le vide → ajouter une section de niveau 1
      addChildItem.style.display = 'flex';
      addChildItem.querySelector('span').textContent = 'Ajouter une section (niveau 1)';
      editItem.style.display = 'none';
      deleteItem.style.display = 'none';
      contextMenuParent = null;
    }

    // Positionner le menu
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;
    contextMenu.style.display = 'block';
  }

  /**
   * Gère les actions du menu contextuel
   */
  function handleContextMenuAction(action) {
    switch (action) {
      case 'add-child':
        openSectionModalForAdd(contextMenuParent);
        break;
      case 'edit':
        if (contextMenuTarget) {
          openSectionModalForEdit(contextMenuTarget);
        }
        break;
      case 'delete':
        if (contextMenuTarget) {
          deleteSection(contextMenuTarget);
        }
        break;
    }
  }

  /**
   * Initialise les événements du modal
   */
  function initSectionModal() {
    const modal = document.getElementById('sectionModal');
    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');
    const modalSave = document.getElementById('modalSave');

    // Fermer le modal
    if (modalClose) {
      modalClose.addEventListener('click', closeSectionModal);
    }
    if (modalCancel) {
      modalCancel.addEventListener('click', closeSectionModal);
    }

    // Sauvegarder
    if (modalSave) {
      modalSave.addEventListener('click', saveSectionFromModal);
    }

    // Fermer en cliquant sur l'overlay
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeSectionModal();
        }
      });
    }

    // Enter pour sauvegarder
    const sectionTitle = document.getElementById('sectionTitle');
    if (sectionTitle) {
      sectionTitle.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveSectionFromModal();
        }
      });
    }
  }

  /**
   * Handler du double-clic pour éditer (déclaré en dehors pour éviter les doublons)
   */
  function handleSectionDoubleClick(e) {
    const titleElement = e.target.closest('.section-title');
    if (!titleElement) return;

    const sectionDiv = titleElement.closest('.section');
    if (!sectionDiv || !sectionDiv.dataset.sectionId) return;

    const sectionId = sectionDiv.dataset.sectionId;
    const section = findSectionById(sectionId, sectionsTree);
    
    if (section) {
      openSectionModalForEdit(section);
    }
  }

  /**
   * Initialise le double-clic sur les titres du sommaire pour éditer
   */
  function initSectionDoubleClick() {
    const sommaireList = document.querySelector('[data-sommaire-list]');
    const annexesList = document.querySelector('[data-annexes-list]');

    // Retirer les événements existants pour éviter les doublons
    if (sommaireList) {
      sommaireList.removeEventListener('dblclick', handleSectionDoubleClick);
      sommaireList.addEventListener('dblclick', handleSectionDoubleClick);
    }
    if (annexesList) {
      annexesList.removeEventListener('dblclick', handleSectionDoubleClick);
      annexesList.addEventListener('dblclick', handleSectionDoubleClick);
    }
  }

  /**
   * Ouvre le modal pour ajouter une section (avec parent automatique)
   * @param {Object|null} parent - Section parente (null pour niveau 1)
   */
  function openSectionModalForAdd(parent = null) {
    const modal = document.getElementById('sectionModal');
    const modalTitle = document.getElementById('modalTitle');
    const sectionId = document.getElementById('sectionId');
    const sectionTitle = document.getElementById('sectionTitle');
    const sectionLevel = document.getElementById('sectionLevel');
    const sectionParent = document.getElementById('sectionParent');
    const sectionLevelInfo = document.getElementById('sectionLevelInfo');

    if (!modal) return;

    currentEditSection = null;
    contextMenuParent = parent;

    // Déterminer le niveau et le parent
    const level = parent ? parent.level + 1 : 1;
    const parentId = parent ? parent.id : '';

    modalTitle.textContent = 'Ajouter une section';
    sectionId.value = '';
    sectionTitle.value = '';
    sectionLevel.value = level;
    sectionParent.value = parentId;

    // Afficher l'info de niveau/parent
    if (parent) {
      sectionLevelInfo.innerHTML = `
        <strong>Niveau :</strong> ${level}<br>
        <strong>Parent :</strong> ${parent.title || '(Sans titre)'}
      `;
    } else {
      sectionLevelInfo.innerHTML = `<strong>Niveau :</strong> 1 (racine)`;
    }

    // Focus sur le champ titre
    modal.style.display = 'flex';
    setTimeout(() => sectionTitle.focus(), 100);
  }

  /**
   * Ouvre le modal pour éditer une section
   * @param {Object} section - Section à éditer
   */
  function openSectionModalForEdit(section) {
    const modal = document.getElementById('sectionModal');
    const modalTitle = document.getElementById('modalTitle');
    const sectionId = document.getElementById('sectionId');
    const sectionTitle = document.getElementById('sectionTitle');
    const sectionLevel = document.getElementById('sectionLevel');
    const sectionParent = document.getElementById('sectionParent');
    const sectionLevelInfo = document.getElementById('sectionLevelInfo');

    if (!modal || !section) return;

    currentEditSection = section;
    contextMenuParent = findParentSection(section.id, sectionsTree);

    modalTitle.textContent = 'Éditer la section';
    sectionId.value = section.id;
    sectionTitle.value = section.title || '';
    sectionLevel.value = section.level || 1;
    sectionParent.value = contextMenuParent ? contextMenuParent.id : '';

    // Afficher l'info de niveau/parent
    if (contextMenuParent) {
      sectionLevelInfo.innerHTML = `
        <strong>Niveau :</strong> ${section.level}<br>
        <strong>Parent :</strong> ${contextMenuParent.title || '(Sans titre)'}
      `;
    } else {
      sectionLevelInfo.innerHTML = `<strong>Niveau :</strong> ${section.level} (racine)`;
    }

    // Focus sur le champ titre
    modal.style.display = 'flex';
    setTimeout(() => {
      sectionTitle.focus();
      sectionTitle.select();
    }, 100);
  }

  /**
   * Ferme le modal
   */
  function closeSectionModal() {
    const modal = document.getElementById('sectionModal');
    if (modal) {
      modal.style.display = 'none';
    }
    currentEditSection = null;
  }

  /**
   * Supprime une section
   */
  function deleteSection(section) {
    if (!section) return;

    const confirmMsg = section.children && section.children.length > 0
      ? `Supprimer "${section.title}" et ses ${section.children.length} sous-section(s) ?`
      : `Supprimer "${section.title}" ?`;

    if (!confirm(confirmMsg)) return;

    // Retirer la section de l'arbre
    removeSectionFromTree(section);

    // Recalculer la numérotation
    recalculateNumbering();

    // Re-render
    renderSommaire();
    renderContent();

    console.log('✅ Section supprimée:', section.title);
  }

  /**
   * Sauvegarde la section depuis le modal
   */
  function saveSectionFromModal() {
    const sectionId = document.getElementById('sectionId').value;
    const sectionTitle = document.getElementById('sectionTitle').value.trim();
    const sectionLevel = parseInt(document.getElementById('sectionLevel').value);
    const sectionParent = document.getElementById('sectionParent').value;

    if (!sectionTitle) {
      alert('Le titre est obligatoire');
      return;
    }

    if (sectionId) {
      // Mode édition : juste changer le titre
      editSection(sectionId, sectionTitle);
    } else {
      // Mode création
      createSection(sectionTitle, sectionLevel, sectionParent);
    }

    // Recalculer la numérotation
    recalculateNumbering();

    // Re-render
    renderSommaire();
    renderContent();

    // Fermer le modal
    closeSectionModal();
  }

  /**
   * Crée une nouvelle section
   */
  function createSection(title, level, parentId) {
    const newSection = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'section',
      title: title,
      level: level,
      numbering: null,
      order: 0,
      isAnnex: false,
      content: [],
      children: []
    };

    if (level === 1) {
      // Ajouter au niveau racine
      sectionsTree.push(newSection);
    } else {
      // Ajouter comme enfant du parent
      const parent = findSectionById(parentId, sectionsTree);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(newSection);
      } else {
        console.error('Parent non trouvé:', parentId);
      }
    }

    console.log('✅ Section créée:', newSection);
  }

  /**
   * Édite une section existante (juste le titre)
   */
  function editSection(sectionId, newTitle) {
    const section = findSectionById(sectionId, sectionsTree);
    if (!section) {
      console.error('Section non trouvée:', sectionId);
      return;
    }

    // Mettre à jour le titre
    section.title = newTitle;

    console.log('✅ Section éditée:', section);
  }

  /**
   * Initialisation
   */
  function init() {
    initViewTabs();
    initCardBackButton();
    initContextMenu();
    initSectionModal();
    loadDocument();
  }

  init();
})();
