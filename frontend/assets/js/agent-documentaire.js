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
  let selectedElement = null; // Élément actuellement sélectionné pour édition

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

      // Charger le canevas (ou l'initialiser si absent)
      if (!documentJson.canvas) {
        await initializeCanvasIfNeeded();
        // Recharger le document pour avoir le canevas
        const reloadResponse = await fetch(url);
        const reloadPayload = await reloadResponse.json();
        if (reloadPayload.success) {
          documentJson = reloadPayload.data.json_content;
        }
      }

      // Appliquer les marges de page (canevas en priorité, sinon Word)
      const margins = documentJson.canvas?.pageMargins || documentJson.pageMargins;
      applyPageMargins(margins);

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
   * Convertit les styles en CSS inline (utilise le canevas si disponible, sinon styles Word)
   * @param {Object} styles - Styles extraits depuis Word (fallback)
   * @param {boolean} isTitle - Si true, c'est un titre de section
   * @param {number} level - Niveau du titre (1, 2, 3) - requis si isTitle = true
   * @param {boolean} ignoreWordIndentation - Si true, ignore l'indentation Word et utilise uniquement les marges du canevas
   * @returns {string} CSS inline
   */
  function stylesToCSS(styles, isTitle = false, level = 1, ignoreWordIndentation = false) {
    const cssProps = [];
    
    // Vérifier si un canevas existe
    const canvas = documentJson?.canvas;
    let canvasStyles = null;
    
    if (canvas) {
      if (isTitle) {
        // Utiliser le canevas pour les titres selon le niveau
        const levelKey = `level${Math.min(level, 3)}`;
        canvasStyles = canvas.titles?.[levelKey];
      } else {
        // Utiliser le canevas pour les paragraphes
        canvasStyles = canvas.paragraphs?.default;
      }
    }
    
    // Fusionner : canevas en priorité, styles Word en fallback
    const mergedStyles = { ...styles };
    if (canvasStyles) {
      // Fusionner les propriétés du canevas
      Object.keys(canvasStyles).forEach(key => {
        if (canvasStyles[key] !== null && canvasStyles[key] !== undefined) {
          mergedStyles[key] = canvasStyles[key];
        }
      });
    }
    
    // Propriétés de police (canevas ou Word)
    if (mergedStyles.fontFamily) {
      cssProps.push(`font-family: '${mergedStyles.fontFamily}'`);
    }
    if (mergedStyles.fontSize) {
      cssProps.push(`font-size: ${mergedStyles.fontSize}pt`);
    }
    if (mergedStyles.color) {
      cssProps.push(`color: ${mergedStyles.color}`);
    }
    
    // Font-weight : canevas ou Word (bold)
    if (mergedStyles.fontWeight) {
      cssProps.push(`font-weight: ${mergedStyles.fontWeight}`);
    } else if (mergedStyles.bold && !canvasStyles) {
      cssProps.push('font-weight: bold');
    }
    
    if (mergedStyles.italic) {
      cssProps.push('font-style: italic');
    }
    if (mergedStyles.underline) {
      cssProps.push('text-decoration: underline');
    }
    
    // Text-transform : canevas ou Word (caps)
    if (mergedStyles.textTransform) {
      cssProps.push(`text-transform: ${mergedStyles.textTransform}`);
    } else if (mergedStyles.caps && !canvasStyles) {
      cssProps.push('text-transform: uppercase');
    }
    
    // Alignement : canevas (alignment) ou Word (alignment)
    const alignment = mergedStyles.alignment || mergedStyles.textAlign;
    if (alignment) {
      cssProps.push(`text-align: ${alignment}`);
    }
    
    // Couleur de fond : toujours depuis Word (pas dans le canevas pour l'instant)
    if (styles.backgroundColor) {
      cssProps.push(`background-color: ${styles.backgroundColor}`);
    }
    if (styles.runBackgroundColor && !styles.backgroundColor) {
      cssProps.push(`background-color: ${styles.runBackgroundColor}`);
    }
    
    // Marges : canevas en priorité, sinon Word
    if (canvasStyles) {
      // Utiliser les marges du canevas
      if (mergedStyles.marginTop !== undefined && mergedStyles.marginTop !== null && mergedStyles.marginTop > 0) {
        cssProps.push(`margin-top: ${mergedStyles.marginTop}pt`);
      }
      // marginBottom : uniquement si défini et > 0 (évite les traits blancs dans les surlignages)
      if (mergedStyles.marginBottom !== undefined && mergedStyles.marginBottom !== null && mergedStyles.marginBottom > 0) {
        cssProps.push(`margin-bottom: ${mergedStyles.marginBottom}pt`);
      }
    } else if (styles.spacing) {
      // Fallback : utiliser les marges Word (uniquement si > 0)
      if (styles.spacing.before && styles.spacing.before > 0) {
        cssProps.push(`margin-top: ${styles.spacing.before}pt`);
      }
      if (styles.spacing.after && styles.spacing.after > 0) {
        cssProps.push(`margin-bottom: ${styles.spacing.after}pt`);
      }
    }
    
    // Line-height : canevas pour paragraphes, sinon Word
    if (!isTitle) {
      if (canvasStyles && mergedStyles.lineHeight) {
        cssProps.push(`line-height: ${mergedStyles.lineHeight}`);
      } else if (styles.spacing && styles.spacing.line) {
        if (styles.spacing.lineType === 'fixed') {
          cssProps.push(`line-height: ${styles.spacing.line}pt`);
        } else {
          cssProps.push(`line-height: ${styles.spacing.line}`);
        }
      }
    }
    
    // Text-indent : canevas ou Word
    if (canvasStyles && mergedStyles.textIndent) {
      cssProps.push(`text-indent: ${mergedStyles.textIndent}pt`);
    } else if (styles.indentation && styles.indentation.firstLine) {
      cssProps.push(`text-indent: ${styles.indentation.firstLine}pt`);
    }
    
    // Indentation + Marges de page (logique simplifiée)
    // Par défaut : appliquer les marges de page
    // Si Word a une marge négative : transformer en padding pour protéger le texte
    
    // Si ignoreWordIndentation est true (ex: titre "Sommaire")
    if (ignoreWordIndentation) {
      // Pour le margin-left : utiliser uniquement la marge de page du canevas (ignorer l'indentation Word)
      if (pageMargins && pageMargins.left) {
        cssProps.push(`margin-left: ${pageMargins.left}pt`);
      }
      
      // Pour le margin-right : appliquer le margin-right négatif de Word avec padding si défini, sinon utiliser la marge du canevas
      const rightIndent = styles.indentation?.right ?? 0;
      if (rightIndent < 0) {
        // Marge négative : sortir du bord + padding pour protéger le texte
        cssProps.push(`margin-right: ${rightIndent}pt`);
        cssProps.push(`padding-right: ${pageMargins.right}pt`);
      } else if (pageMargins && pageMargins.right) {
        // Pas d'indentation négative : utiliser la marge de page du canevas
        cssProps.push(`margin-right: ${pageMargins.right}pt`);
      }
    } else {
      // Logique normale : prendre en compte l'indentation Word
      const leftIndent = styles.indentation?.left ?? 0;
      const rightIndent = styles.indentation?.right ?? 0;
      
      // Gestion de la marge gauche
      if (leftIndent < 0) {
        // Marge négative : sortir du bord + padding pour protéger le texte
        cssProps.push(`margin-left: ${leftIndent}pt`);
        cssProps.push(`padding-left: ${pageMargins.left}pt`);
      } else if (leftIndent > 0) {
        // Indentation positive : ajouter à la marge de page
        cssProps.push(`margin-left: ${leftIndent + pageMargins.left}pt`);
      } else {
        // Pas d'indentation : appliquer uniquement la marge de page
        cssProps.push(`margin-left: ${pageMargins.left}pt`);
      }
      
      // Gestion de la marge droite
      if (rightIndent < 0) {
        // Marge négative : sortir du bord + padding pour protéger le texte
        cssProps.push(`margin-right: ${rightIndent}pt`);
        cssProps.push(`padding-right: ${pageMargins.right}pt`);
      } else if (rightIndent > 0) {
        // Indentation positive : ajouter à la marge de page
        cssProps.push(`margin-right: ${rightIndent + pageMargins.right}pt`);
      } else {
        // Pas d'indentation : appliquer uniquement la marge de page
        cssProps.push(`margin-right: ${pageMargins.right}pt`);
      }
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
    const isSommaire = section.type === 'sommaire' || section.isSommaire;

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
      // Pour le sommaire, utiliser le niveau 1 par défaut si le niveau est 0 ou non défini
      let titleLevel = section.level || level;
      if (isSommaire && (titleLevel === 0 || !titleLevel)) {
        titleLevel = 1; // Utiliser le niveau 1 du canevas pour le titre "Sommaire"
      }
      // Pour le titre "Sommaire", ignorer l'indentation Word et utiliser uniquement les marges du canevas
      const ignoreWordIndentation = isSommaire;
      const titleStyleAttr = stylesToCSS(titleStyles, true, titleLevel, ignoreWordIndentation); // isTitle=true, level requis
      const titleStyleString = titleStyleAttr ? ` style="${titleStyleAttr}"` : '';
      
      // Rendre le titre éditable
      html += `<${headingTag} class="section-title editable-text" contenteditable="true" data-section-id="${sectionId}" data-edit-type="title"${titleStyleString}>${displayTitle}</${headingTag}>`;
    }

    // Si c'est une section sommaire, remplacer le contenu par un sommaire dynamique
    if (isSommaire) {
      // Générer le sommaire dynamique depuis toutes les sections (pas seulement les enfants)
      html += generateDynamicTocHTML(sectionsTree);
    } else {
      // Contenu normal (paragraphes, images, etc.)
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
          // Rendre le paragraphe éditable
          const paragraphId = item.id || `para_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          html += `<p class="editable-text" contenteditable="true" data-paragraph-id="${paragraphId}" data-edit-type="paragraph"${paragraphStyleString}><span style="background-color: ${styles.runBackgroundColor}">${displayText}</span></p>`;
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
          // Rendre le paragraphe éditable
          const paragraphId = item.id || `para_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          html += `<p class="editable-text" contenteditable="true" data-paragraph-id="${paragraphId}" data-edit-type="paragraph"${styleString}>${displayText}</p>`;
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
        
        // Rotation extraite du Word
        if (item.rotation !== null && item.rotation !== undefined && item.rotation !== 0) {
          imgStyleProps.push(`transform: rotate(${item.rotation}deg)`);
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
    }

    // Enfants récursifs (sauf pour le sommaire qui affiche déjà toutes les sections)
    if (!isSommaire) {
      children.forEach(child => {
        html += generateSectionHTML(child, level + 1, hideTitle);
      });
    }

    html += '</div>';
    return html;
  }

  /**
   * Génère le HTML du sommaire dynamique pour la colonne 2 (contenu)
   * Structure : indentation | numérotation | titre | ....... | page
   * @param {Array} sections - Arbre de sections
   * @param {number} maxLevel - Niveau maximum (défaut: 3)
   * @returns {string} HTML du sommaire
   */
  function generateDynamicTocHTML(sections, maxLevel = 3) {
    if (!Array.isArray(sections)) return '';
    
    let html = '<div class="dynamic-toc">';
    
    const traverse = (sectionList, level = 1) => {
      if (!Array.isArray(sectionList)) return;
      
      sectionList.forEach(section => {
        // Ignorer introduction, sommaire, et sections annexes parentes
        if (section.type === 'introduction' || section.isSommaire) {
          // Traverser les enfants mais ne pas les afficher
          if (section.children && section.children.length > 0) {
            traverse(section.children, level);
          }
          return;
        }
        
        const sectionLevel = section.level || 1;
        
        // Ne pas afficher si niveau > maxLevel
        if (sectionLevel > maxLevel) {
          // Traverser quand même les enfants
          if (section.children && section.children.length > 0) {
            traverse(section.children, sectionLevel);
          }
          return;
        }
        
        const sectionId = section.id || '';
        const title = section.title || '(Sans titre)';
        const numbering = section.numbering || '';
        
        // Indentation selon le niveau en pixels
        const indent = (sectionLevel - 1) * 20; // Indentation en pixels
        
        // Appliquer les marges de page (left et right) par défaut aux entrées du sommaire
        const tocStyleProps = [];
        
        // Marge gauche : indentation + marge de page
        if (indent > 0) {
          tocStyleProps.push(`padding-left: ${indent}px`);
        }
        if (pageMargins && pageMargins.left) {
          tocStyleProps.push(`margin-left: ${pageMargins.left}pt`);
        }
        
        // Marge droite : marge de page
        if (pageMargins && pageMargins.right) {
          tocStyleProps.push(`margin-right: ${pageMargins.right}pt`);
        }
        
        const tocStyle = tocStyleProps.length > 0 ? tocStyleProps.join('; ') : '';
        
        html += `<div class="toc-entry" 
                     data-section-id="${sectionId}" 
                     data-level="${sectionLevel}"
                     ${tocStyle ? `style="${tocStyle}"` : ''}>`;
        html += `<span class="toc-numbering">${numbering || ''}</span>`;
        html += `<span class="toc-title">${title}</span>`;
        html += `<span class="toc-dots">.......</span>`;
        html += `<span class="toc-page">?</span>`; // Sera calculé plus tard
        html += '</div>';
        
        // Traverser les enfants
        if (section.children && section.children.length > 0) {
          traverse(section.children, sectionLevel);
        }
      });
    };
    
    traverse(sections);
    
    html += '</div>';
    return html;
  }

  /**
   * Génère le HTML du sommaire récursivement jusqu'au niveau 3
   * NE GÉNÈRE QUE LES TITRES - pas de contenu
   * UTILISÉ UNIQUEMENT POUR LA COLONNE DE GAUCHE (navigation)
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
    
    // Calculer les numéros de page après le rendu
    setTimeout(() => {
      calculatePageNumbers();
      attachDynamicTocClickEvents();
      // Attacher les événements de clic pour afficher les propriétés
      attachContentClickEvents();
      // Attacher les événements de scroll pour empêcher le scroll global
      attachScrollPrevention();
      // Attacher les événements d'édition de texte
      attachTextEditEvents();
    }, 100);
  }

  /**
   * Attache les événements de clic sur les entrées du sommaire dynamique
   * pour scroller vers la section correspondante
   */
  function attachDynamicTocClickEvents() {
    const contentArea = document.querySelector('[data-content-area]');
    if (!contentArea) return;
    
    const tocEntries = contentArea.querySelectorAll('.dynamic-toc .toc-entry');
    tocEntries.forEach(entry => {
      entry.addEventListener('click', () => {
        const sectionId = entry.dataset.sectionId;
        if (!sectionId) return;
        
        // Trouver la section correspondante dans le contenu
        const targetSection = contentArea.querySelector(`.section[data-section-id="${sectionId}"]`);
        
        if (targetSection) {
          // Scroller vers la section
          targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          
          // Effet visuel temporaire
          targetSection.style.transition = 'background-color 0.3s';
          targetSection.style.backgroundColor = '#e3f2fd';
          setTimeout(() => {
            targetSection.style.backgroundColor = '';
          }, 1000);
        }
      });
    });
  }

  /**
   * Calcule les numéros de page depuis les positions des sections dans le DOM
   * et met à jour le sommaire dynamique
   */
  function calculatePageNumbers() {
    const contentArea = document.querySelector('[data-content-area]');
    if (!contentArea) return;
    
    // Hauteur approximative d'une page A4 en pixels (à 96 DPI, ~1123px = 29.7cm)
    const contentAreaRect = contentArea.getBoundingClientRect();
    const pageHeight = 1123; // Hauteur approximative d'une page A4 en pixels
    const pageNumbers = {}; // Map sectionId -> pageNumber
    
    // Parcourir toutes les sections dans le contenu
    const sections = contentArea.querySelectorAll('.section[data-section-id]');
    sections.forEach(section => {
      const sectionId = section.dataset.sectionId;
      if (!sectionId) return;
      
      // Obtenir la position du titre de la section (ou de la section elle-même)
      const sectionTitle = section.querySelector('.section-title');
      const elementToMeasure = sectionTitle || section;
      const rect = elementToMeasure.getBoundingClientRect();
      
      // Position relative au début du contenu
      const relativeTop = rect.top - contentAreaRect.top + contentArea.scrollTop;
      
      // Calculer le numéro de page (commence à 1)
      // On suppose que la première page commence au début du contenu
      const pageNumber = Math.max(1, Math.floor(relativeTop / pageHeight) + 1);
      
      pageNumbers[sectionId] = pageNumber;
    });
    
    // Mettre à jour les numéros de page dans le sommaire dynamique
    const tocEntries = contentArea.querySelectorAll('.dynamic-toc .toc-entry');
    tocEntries.forEach(entry => {
      const sectionId = entry.dataset.sectionId;
      if (!sectionId) return;
      
      const pageSpan = entry.querySelector('.toc-page');
      if (pageSpan && pageNumbers[sectionId]) {
        pageSpan.textContent = pageNumbers[sectionId];
      }
    });
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
        
        // Réattacher la prévention du scroll après le changement de vue
        setTimeout(() => {
          attachScrollPrevention();
        }, 100);
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
   * ===================================
   * GESTION DU CANEVAS
   * ===================================
   */

  let canvasData = null;

  /**
   * Initialise automatiquement le canevas si absent
   */
  async function initializeCanvasIfNeeded() {
    if (!documentId || !apiBase) return;

    try {
      // Vérifier si le canevas existe
      const url = `${apiBase}/agent-documentaire/document/${documentId}/canvas`;
      const response = await fetch(url);
      const payload = await response.json();

      if (payload.success && payload.data) {
        // Canevas existe déjà
        canvasData = payload.data;
        return;
      }

      // Canevas absent : initialiser automatiquement
      console.log('📐 Initialisation automatique du canevas...');
      const initUrl = `${apiBase}/agent-documentaire/document/${documentId}/canvas/initialize`;
      const initResponse = await fetch(initUrl, { method: 'POST' });
      const initPayload = await initResponse.json();

      if (initPayload.success) {
        canvasData = initPayload.data;
        console.log('✅ Canevas initialisé automatiquement');
      }
    } catch (error) {
      console.warn('⚠️ Erreur initialisation canevas:', error);
    }
  }

  /**
   * Charge le canevas depuis l'API
   */
  async function loadCanvas() {
    if (!documentId || !apiBase) return;

    try {
      const url = `${apiBase}/agent-documentaire/document/${documentId}/canvas`;
      const response = await fetch(url);
      const payload = await response.json();

      if (payload.success) {
        canvasData = payload.data;
        return canvasData;
      }
    } catch (error) {
      console.error('❌ Erreur chargement canevas:', error);
    }
    return null;
  }

  /**
   * Sauvegarde le canevas
   */
  async function saveCanvas(canvas) {
    if (!documentId || !apiBase) return false;

    try {
      const url = `${apiBase}/agent-documentaire/document/${documentId}/canvas`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvas: canvas })
      });

      const payload = await response.json();
      if (payload.success) {
        canvasData = payload.data;
        return true;
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde canevas:', error);
    }
    return false;
  }

  /**
   * Remplit le formulaire du modal avec les données du canevas
   */
  function populateCanvasForm() {
    if (!canvasData) return;

    // Titres
    for (let level = 1; level <= 3; level++) {
      const levelData = canvasData.titles?.[`level${level}`];
      if (levelData) {
        const levelPanel = document.querySelector(`.canvas-level[data-level="${level}"]`);
        if (levelPanel) {
          Object.keys(levelData).forEach(key => {
            const input = levelPanel.querySelector(`[data-field="${key}"]`);
            if (input) {
              if (input.type === 'color') {
                input.value = levelData[key] || '#000000';
              } else {
                input.value = levelData[key] || '';
              }
            }
          });
        }
      }
    }

    // Paragraphes
    const paragraphData = canvasData.paragraphs?.default;
    if (paragraphData) {
      const paragraphPanel = document.querySelector('.canvas-tab-panel[data-panel="paragraphs"]');
      if (paragraphPanel) {
        Object.keys(paragraphData).forEach(key => {
          const input = paragraphPanel.querySelector(`[data-field="${key}"]`);
          if (input) {
            input.value = paragraphData[key] || '';
          }
        });
      }
    }

    // Images
    const imageData = canvasData.images?.default;
    if (imageData) {
      const imagePanel = document.querySelector('.canvas-tab-panel[data-panel="images"]');
      if (imagePanel) {
        Object.keys(imageData).forEach(key => {
          const input = imagePanel.querySelector(`[data-field="${key}"]`);
          if (input) {
            input.value = imageData[key] || '';
          }
        });
      }
    }

    // Annexes
    const annexData = canvasData.annexes?.default;
    if (annexData) {
      const annexPanel = document.querySelector('.canvas-tab-panel[data-panel="annexes"]');
      if (annexPanel) {
        Object.keys(annexData).forEach(key => {
          const input = annexPanel.querySelector(`[data-field="${key}"]`);
          if (input) {
            if (input.type === 'color') {
              input.value = annexData[key] || '#000000';
            } else {
              input.value = annexData[key] || '';
            }
          }
        });
      }
    }

    // Marges
    const margins = canvasData.pageMargins;
    if (margins) {
      const marginPanel = document.querySelector('.canvas-tab-panel[data-panel="margins"]');
      if (marginPanel) {
        ['top', 'right', 'bottom', 'left'].forEach(side => {
          const input = marginPanel.querySelector(`[data-field="${side}"]`);
          if (input) {
            input.value = margins[side] || '';
          }
        });
      }
    }
  }

  /**
   * Récupère les données du formulaire
   */
  function getCanvasFormData() {
    const canvas = {
      titles: {},
      paragraphs: {},
      images: {},
      annexes: {},
      pageMargins: {},
      locked: canvasData?.locked || {
        pageMargins: false,
        titles: { level1: {}, level2: {}, level3: {} },
        paragraphs: { default: {} }
      },
      metadata: {
        ...canvasData?.metadata,
        updatedAt: new Date().toISOString(),
        version: (canvasData?.metadata?.version || 0) + 1
      }
    };

    // Titres
    for (let level = 1; level <= 3; level++) {
      const levelPanel = document.querySelector(`.canvas-level[data-level="${level}"]`);
      if (levelPanel) {
        canvas.titles[`level${level}`] = {};
        levelPanel.querySelectorAll('[data-field]').forEach(input => {
          const field = input.dataset.field;
          let value = input.value;
          if (input.type === 'number') {
            value = parseFloat(value) || 0;
          }
          canvas.titles[`level${level}`][field] = value;
        });
      }
    }

    // Paragraphes
    const paragraphPanel = document.querySelector('.canvas-tab-panel[data-panel="paragraphs"]');
    if (paragraphPanel) {
      canvas.paragraphs.default = {};
      paragraphPanel.querySelectorAll('[data-field]').forEach(input => {
        const field = input.dataset.field;
        let value = input.value;
        if (input.type === 'number') {
          value = parseFloat(value) || 0;
        }
        canvas.paragraphs.default[field] = value;
      });
    }

    // Images
    const imagePanel = document.querySelector('.canvas-tab-panel[data-panel="images"]');
    if (imagePanel) {
      canvas.images.default = {};
      imagePanel.querySelectorAll('[data-field]').forEach(input => {
        const field = input.dataset.field;
        let value = input.value;
        if (input.type === 'number') {
          value = parseFloat(value) || 0;
        }
        canvas.images.default[field] = value;
      });
    }

    // Annexes
    const annexPanel = document.querySelector('.canvas-tab-panel[data-panel="annexes"]');
    if (annexPanel) {
      canvas.annexes.default = {};
      annexPanel.querySelectorAll('[data-field]').forEach(input => {
        const field = input.dataset.field;
        let value = input.value;
        if (input.type === 'number') {
          value = parseFloat(value) || 0;
        } else if (input.type === 'color') {
          value = value || '#000000';
        }
        canvas.annexes.default[field] = value;
      });
    }

    // Marges
    const marginPanel = document.querySelector('.canvas-tab-panel[data-panel="margins"]');
    if (marginPanel) {
      ['top', 'right', 'bottom', 'left'].forEach(side => {
        const input = marginPanel.querySelector(`[data-field="${side}"]`);
        if (input) {
          canvas.pageMargins[side] = parseFloat(input.value) || 0;
        }
      });
    }

    return canvas;
  }

  /**
   * Initialise le modal de canevas
   */
  function initCanvasModal() {
    const modal = document.getElementById('canvasModal');
    const editBtn = document.getElementById('editCanvasBtn');
    const closeBtn = document.getElementById('canvasModalClose');
    const cancelBtn = document.getElementById('canvasModalCancel');
    const saveBtn = document.getElementById('canvasModalSave');
    const tabs = document.querySelectorAll('.canvas-tab');
    const presetSelect = document.getElementById('canvasPresetSelect');
    const applyPresetBtn = document.getElementById('applyPresetBtn');

    // Ouvrir le modal
    if (editBtn) {
      editBtn.addEventListener('click', async () => {
        await loadCanvas();
        if (canvasData) {
          populateCanvasForm();
          modal.style.display = 'flex';
        } else {
          alert('Erreur : Impossible de charger le canevas');
        }
      });
    }

    // Fermer le modal
    const closeModal = () => {
      modal.style.display = 'none';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // Gestion des onglets
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // Désactiver tous les onglets
        tabs.forEach(t => t.classList.remove('is-active'));
        document.querySelectorAll('.canvas-tab-panel').forEach(p => p.classList.remove('is-active'));

        // Activer l'onglet cliqué
        tab.classList.add('is-active');
        const panel = document.querySelector(`.canvas-tab-panel[data-panel="${targetTab}"]`);
        if (panel) panel.classList.add('is-active');
      });
    });

    // Appliquer un preset
    if (applyPresetBtn && presetSelect) {
      applyPresetBtn.addEventListener('click', async () => {
        const presetName = presetSelect.value;
        if (!presetName) {
          alert('Veuillez sélectionner un preset');
          return;
        }

        try {
          const url = `${apiBase}/agent-documentaire/document/${documentId}/canvas/initialize?preset=${presetName}`;
          const response = await fetch(url, { method: 'POST' });
          const payload = await response.json();

          if (payload.success) {
            canvasData = payload.data;
            populateCanvasForm();
            alert('Preset appliqué avec succès !');
          }
        } catch (error) {
          console.error('Erreur application preset:', error);
          alert('Erreur lors de l\'application du preset');
        }
      });
    }

    // Sauvegarder
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const canvas = getCanvasFormData();
        const success = await saveCanvas(canvas);
        
        if (success) {
          alert('Canevas enregistré avec succès !');
          closeModal();
          // Recharger le document pour appliquer le nouveau canevas
          await loadDocument();
        } else {
          alert('Erreur lors de l\'enregistrement du canevas');
        }
      });
    }
  }

  /**
   * Extrait les propriétés CSS d'un élément
   * @param {HTMLElement} element - Élément HTML
   * @returns {Object} Propriétés extraites
   */
  function extractElementProperties(element) {
    const computedStyle = window.getComputedStyle(element);
    
    // Extraire la police (retirer les guillemets si présents)
    let fontFamily = computedStyle.fontFamily || '';
    fontFamily = fontFamily.replace(/^["']|["']$/g, '').split(',')[0].trim();
    
    // Extraire la taille (convertir en pt si nécessaire)
    let fontSize = computedStyle.fontSize || '';
    if (fontSize && fontSize.includes('px')) {
      // Convertir px en pt (1px ≈ 0.75pt, mais on utilise 0.75 pour être précis)
      const pxValue = parseFloat(fontSize);
      fontSize = `${(pxValue * 0.75).toFixed(1)}pt`;
    }
    
    // Couleur du texte
    const color = computedStyle.color || '';
    
    // Couleur de fond (ignorer si c'est la couleur de sélection)
    let backgroundColor = computedStyle.backgroundColor || '';
    
    // Couleur de sélection : rgba(75, 158, 216, 0.1)
    const selectionColor = 'rgba(75, 158, 216, 0.1)';
    const selectionColorAlt = 'rgba(75, 158, 216, 0.10)'; // Variante possible
    
    // Ignorer la couleur de fond si c'est celle de la sélection
    if (backgroundColor === selectionColor || backgroundColor === selectionColorAlt) {
      backgroundColor = '';
    }
    
    // Ignorer aussi les couleurs transparentes
    if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
      backgroundColor = '';
    }
    
    // Alignement
    // Pour les images, vérifier le conteneur parent
    let textAlign = '';
    if (element.tagName === 'IMG') {
      const container = element.parentElement;
      if (container && container.tagName === 'DIV') {
        const containerStyle = window.getComputedStyle(container);
        textAlign = containerStyle.textAlign || '';
      } else {
        textAlign = computedStyle.textAlign || '';
      }
    } else {
      textAlign = computedStyle.textAlign || '';
    }
    
    let alignment = '';
    if (textAlign) {
      // Traduire les valeurs CSS en français
      switch (textAlign) {
        case 'left':
          alignment = 'Gauche';
          break;
        case 'center':
          alignment = 'Centre';
          break;
        case 'right':
          alignment = 'Droite';
          break;
        case 'justify':
          alignment = 'Justifié';
          break;
        default:
          alignment = textAlign;
      }
    }
    
    // Pour les images, extraire les dimensions et la rotation
    let width = '';
    let height = '';
    let rotation = '';
    if (element.tagName === 'IMG') {
      // Utiliser les dimensions naturelles ou les dimensions CSS
      const imgWidth = element.naturalWidth || element.width || computedStyle.width;
      const imgHeight = element.naturalHeight || element.height || computedStyle.height;
      
      if (imgWidth) {
        width = typeof imgWidth === 'number' ? `${imgWidth}px` : imgWidth;
      }
      if (imgHeight) {
        height = typeof imgHeight === 'number' ? `${imgHeight}px` : imgHeight;
      }
      
      // Extraire la rotation depuis transform
      const transform = computedStyle.transform || '';
      if (transform && transform.includes('rotate')) {
        const match = transform.match(/rotate\(([^)]+)\)/);
        if (match) {
          rotation = match[1].trim();
        }
      }
    }
    
    return {
      fontFamily: fontFamily,
      fontSize: fontSize,
      color: color,
      backgroundColor: backgroundColor,
      alignment: alignment,
      width: width,
      height: height,
      rotation: rotation
    };
  }

  /**
   * Affiche les propriétés d'un élément dans la colonne de droite
   * @param {HTMLElement} element - Élément HTML cliqué
   */
  function displayElementProperties(element) {
    const propertiesArea = document.querySelector('[data-properties-area]');
    if (!propertiesArea) return;

    // Stocker l'élément sélectionné
    selectedElement = element;

    const properties = extractElementProperties(element);
    const computedStyle = window.getComputedStyle(element);
    
    // Déterminer le type d'élément
    let elementType = 'Élément';
    if (element.tagName === 'H1' || element.tagName === 'H2' || element.tagName === 'H3' || 
        element.tagName === 'H4' || element.tagName === 'H5' || element.tagName === 'H6') {
      elementType = 'Titre';
    } else if (element.tagName === 'P') {
      elementType = 'Paragraphe';
    } else if (element.tagName === 'IMG') {
      elementType = 'Image';
    }

    // Extraire les styles de texte
    const isBold = computedStyle.fontWeight === 'bold' || parseInt(computedStyle.fontWeight) >= 700;
    const isItalic = computedStyle.fontStyle === 'italic';
    const isUnderline = computedStyle.textDecoration.includes('underline');

    // Créer le HTML des propriétés selon le type d'élément
    let html = `
      <div class="property-item">
        <span class="property-label">Type</span>
        <span class="property-value">${elementType}</span>
      </div>
    `;

    if (elementType === 'Image') {
      // Pour les images : afficher dimensions, rotation et alignement
      const currentAlign = properties.alignment || 'Gauche';
      const alignMap = { 'Gauche': 'left', 'Centre': 'center', 'Droite': 'right', 'Justifié': 'justify' };
      const currentAlignValue = alignMap[currentAlign] || 'left';
      
      html += `
        <div class="property-item">
          <span class="property-label">Largeur</span>
          <input type="text" class="property-input" data-property="width" value="${properties.width || ''}" placeholder="auto">
        </div>
        <div class="property-item">
          <span class="property-label">Hauteur</span>
          <input type="text" class="property-input" data-property="height" value="${properties.height || ''}" placeholder="auto">
        </div>
        <div class="property-item">
          <span class="property-label">Rotation</span>
          <input type="text" class="property-input" data-property="rotation" value="${properties.rotation || '0deg'}" placeholder="0deg">
        </div>
        <div class="property-item">
          <span class="property-label">Alignement</span>
          <div class="property-buttons">
            <button class="property-btn ${currentAlignValue === 'left' ? 'is-active' : ''}" data-align="left" title="Gauche">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="15" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <button class="property-btn ${currentAlignValue === 'center' ? 'is-active' : ''}" data-align="center" title="Centre">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="6" y1="12" x2="18" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <button class="property-btn ${currentAlignValue === 'right' ? 'is-active' : ''}" data-align="right" title="Droite">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="9" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      `;
    } else {
      // Pour les textes : afficher police, taille, couleurs, styles et alignement
      const currentAlign = properties.alignment || 'Gauche';
      const alignMap = { 'Gauche': 'left', 'Centre': 'center', 'Droite': 'right', 'Justifié': 'justify' };
      const currentAlignValue = alignMap[currentAlign] || 'left';
      
      html += `
        <div class="property-item">
          <span class="property-label">Police</span>
          <input type="text" class="property-input" data-property="fontFamily" value="${properties.fontFamily || ''}" placeholder="Arial">
        </div>
        <div class="property-item">
          <span class="property-label">Taille</span>
          <input type="text" class="property-input" data-property="fontSize" value="${properties.fontSize || ''}" placeholder="12pt">
        </div>
        <div class="property-item">
          <span class="property-label">Couleur du texte</span>
          <div class="property-color-group">
            <input type="color" class="property-color" data-property="color" value="${properties.color || '#000000'}">
            <input type="text" class="property-input property-input--color" data-property="color" value="${properties.color || ''}" placeholder="#000000">
          </div>
        </div>
        <div class="property-item">
          <span class="property-label">Couleur de fond</span>
          <div class="property-color-group">
            <input type="color" class="property-color" data-property="backgroundColor" value="${properties.backgroundColor || '#ffffff'}">
            <input type="text" class="property-input property-input--color" data-property="backgroundColor" value="${properties.backgroundColor || ''}" placeholder="transparent">
          </div>
        </div>
        <div class="property-item">
          <span class="property-label">Styles</span>
          <div class="property-buttons">
            <button class="property-btn ${isBold ? 'is-active' : ''}" data-style="bold" title="Gras">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
                <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
              </svg>
            </button>
            <button class="property-btn ${isItalic ? 'is-active' : ''}" data-style="italic" title="Italique">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="19" y1="4" x2="10" y2="4"></line>
                <line x1="14" y1="20" x2="5" y2="20"></line>
                <line x1="15" y1="4" x2="9" y2="20"></line>
              </svg>
            </button>
            <button class="property-btn ${isUnderline ? 'is-active' : ''}" data-style="underline" title="Souligné">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
                <line x1="4" y1="21" x2="20" y2="21"></line>
              </svg>
            </button>
          </div>
        </div>
        <div class="property-item">
          <span class="property-label">Alignement</span>
          <div class="property-buttons">
            <button class="property-btn ${currentAlignValue === 'left' ? 'is-active' : ''}" data-align="left" title="Gauche">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="15" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <button class="property-btn ${currentAlignValue === 'center' ? 'is-active' : ''}" data-align="center" title="Centre">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="6" y1="12" x2="18" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <button class="property-btn ${currentAlignValue === 'right' ? 'is-active' : ''}" data-align="right" title="Droite">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="9" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <button class="property-btn ${currentAlignValue === 'justify' ? 'is-active' : ''}" data-align="justify" title="Justifié">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      `;
    }

    propertiesArea.innerHTML = html;
    
    // Attacher les événements
    attachPropertyEvents();
  }

  /**
   * Attache les événements aux contrôles de propriétés
   */
  function attachPropertyEvents() {
    const propertiesArea = document.querySelector('[data-properties-area]');
    if (!propertiesArea || !selectedElement) return;

    // Inputs texte
    const inputs = propertiesArea.querySelectorAll('.property-input');
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        applyProperty(input.dataset.property, input.value);
      });
      input.addEventListener('blur', () => {
        applyProperty(input.dataset.property, input.value);
      });
    });

    // Inputs couleur
    const colorInputs = propertiesArea.querySelectorAll('.property-color');
    colorInputs.forEach(colorInput => {
      colorInput.addEventListener('change', () => {
        const property = colorInput.dataset.property;
        applyProperty(property, colorInput.value);
        // Mettre à jour l'input texte correspondant
        const textInput = propertiesArea.querySelector(`.property-input--color[data-property="${property}"]`);
        if (textInput) {
          textInput.value = colorInput.value;
        }
      });
    });

    // Boutons d'alignement
    const alignButtons = propertiesArea.querySelectorAll('.property-btn[data-align]');
    alignButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Retirer l'état actif de tous les boutons
        alignButtons.forEach(b => b.classList.remove('is-active'));
        // Activer le bouton cliqué
        btn.classList.add('is-active');
        // Appliquer l'alignement
        applyProperty('textAlign', btn.dataset.align);
      });
    });

    // Boutons de style (gras, italique, souligné)
    const styleButtons = propertiesArea.querySelectorAll('.property-btn[data-style]');
    styleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('is-active');
        applyStyle(btn.dataset.style, btn.classList.contains('is-active'));
      });
    });
  }

  /**
   * Applique une propriété à l'élément sélectionné
   * @param {string} property - Nom de la propriété
   * @param {string} value - Valeur à appliquer
   */
  function applyProperty(property, value) {
    if (!selectedElement) return;

    switch (property) {
      case 'fontFamily':
        selectedElement.style.fontFamily = value || '';
        break;
      case 'fontSize':
        selectedElement.style.fontSize = value || '';
        break;
      case 'color':
        selectedElement.style.color = value || '';
        break;
      case 'backgroundColor':
        selectedElement.style.backgroundColor = value || '';
        break;
      case 'textAlign':
        // Pour les images, appliquer l'alignement sur le conteneur parent (div)
        if (selectedElement.tagName === 'IMG') {
          const container = selectedElement.parentElement;
          if (container && container.tagName === 'DIV') {
            container.style.textAlign = value || '';
            // Ajuster le display de l'image selon l'alignement
            if (value === 'center') {
              selectedElement.style.display = 'block';
              selectedElement.style.marginLeft = 'auto';
              selectedElement.style.marginRight = 'auto';
            } else if (value === 'left' || value === 'right') {
              selectedElement.style.display = 'block';
              selectedElement.style.marginLeft = value === 'left' ? '0' : 'auto';
              selectedElement.style.marginRight = value === 'right' ? '0' : 'auto';
            } else {
              selectedElement.style.display = 'block';
              selectedElement.style.marginLeft = '';
              selectedElement.style.marginRight = '';
            }
          } else {
            // Pas de conteneur, appliquer directement
            selectedElement.style.textAlign = value || '';
          }
        } else {
          // Pour les textes (titres, paragraphes), appliquer directement
          selectedElement.style.textAlign = value || '';
        }
        break;
      case 'width':
        if (selectedElement.tagName === 'IMG') {
          selectedElement.style.width = value || '';
        }
        break;
      case 'height':
        if (selectedElement.tagName === 'IMG') {
          selectedElement.style.height = value || '';
        }
        break;
      case 'rotation':
        if (selectedElement.tagName === 'IMG') {
          if (value && value !== '0deg') {
            // Préserver les autres transformations si présentes
            const currentTransform = selectedElement.style.transform || '';
            const otherTransforms = currentTransform.replace(/rotate\([^)]+\)/g, '').trim();
            selectedElement.style.transform = `rotate(${value})${otherTransforms ? ' ' + otherTransforms : ''}`.trim();
          } else {
            // Retirer uniquement la rotation
            const currentTransform = selectedElement.style.transform || '';
            const newTransform = currentTransform.replace(/rotate\([^)]+\)/g, '').trim();
            selectedElement.style.transform = newTransform || '';
          }
        }
        break;
    }
  }

  /**
   * Applique un style de texte (gras, italique, souligné)
   * @param {string} style - Style à appliquer (bold, italic, underline)
   * @param {boolean} active - Si true, activer le style, sinon le désactiver
   */
  function applyStyle(style, active) {
    if (!selectedElement) return;

    switch (style) {
      case 'bold':
        selectedElement.style.fontWeight = active ? 'bold' : 'normal';
        break;
      case 'italic':
        selectedElement.style.fontStyle = active ? 'italic' : 'normal';
        break;
      case 'underline':
        if (active) {
          selectedElement.style.textDecoration = 'underline';
        } else {
          selectedElement.style.textDecoration = '';
        }
        break;
    }
  }

  /**
   * Attache les événements de clic sur les éléments du contenu
   */
  function attachContentClickEvents() {
    const contentArea = document.querySelector('[data-content-area]');
    if (!contentArea) return;

    // Retirer les événements existants pour éviter les doublons
    contentArea.removeEventListener('click', handleContentClick);

    // Ajouter l'événement de clic (délégation)
    contentArea.addEventListener('click', handleContentClick);
  }

  /**
   * Gère le clic sur un élément du contenu
   * @param {Event} e - Événement de clic
   */
  function handleContentClick(e) {
    // Ignorer les clics sur les éléments interactifs (liens, boutons, etc.)
    if (e.target.closest('a, button, .toc-entry')) {
      return;
    }

    // Récupérer la zone de contenu
    const contentArea = document.querySelector('[data-content-area]');
    if (!contentArea) return;

    // Trouver l'élément cliqué (paragraphe, titre, image)
    let targetElement = null;
    
    // Si c'est un titre, paragraphe ou image directement
    if (e.target.tagName === 'H1' || e.target.tagName === 'H2' || 
        e.target.tagName === 'H3' || e.target.tagName === 'H4' || 
        e.target.tagName === 'H5' || e.target.tagName === 'H6' ||
        e.target.tagName === 'P' || e.target.tagName === 'IMG') {
      targetElement = e.target;
    } else {
      // Chercher le parent le plus proche qui est un titre, paragraphe ou image
      targetElement = e.target.closest('h1, h2, h3, h4, h5, h6, p, img');
    }

    if (targetElement) {
      // Ne jamais ajouter la sélection aux éléments éditables
      if (targetElement.classList.contains('editable-text')) {
        // Juste afficher les propriétés sans ajouter la classe de sélection
        displayElementProperties(targetElement);
        return;
      }

      // Retirer la sélection précédente
      const previousSelected = contentArea.querySelector('.element-selected');
      if (previousSelected) {
        previousSelected.classList.remove('element-selected');
      }

      // Extraire les propriétés AVANT d'ajouter la classe de sélection
      // pour éviter d'inclure la couleur de fond de sélection
      displayElementProperties(targetElement);

      // Ajouter la classe de sélection après l'extraction des propriétés
      targetElement.classList.add('element-selected');
    }
  }

  /**
   * Attache les événements d'édition de texte
   */
  function attachTextEditEvents() {
    const contentArea = document.querySelector('[data-content-area]');
    if (!contentArea) return;

    // Retirer les événements existants pour éviter les doublons
    contentArea.removeEventListener('blur', handleTextEdit, true);
    contentArea.removeEventListener('keydown', handleTextEditKeydown, true);

    // Ajouter les événements (capture pour intercepter avant les autres)
    contentArea.addEventListener('blur', handleTextEdit, true);
    contentArea.addEventListener('keydown', handleTextEditKeydown, true);
  }

  /**
   * Gère l'édition de texte (blur = perte de focus)
   * @param {Event} e - Événement blur
   */
  function handleTextEdit(e) {
    const editableElement = e.target.closest('.editable-text');
    if (!editableElement) return;

    // Retirer la classe de sélection si elle était présente
    editableElement.classList.remove('element-selected');

    const editType = editableElement.dataset.editType;
    const newText = editableElement.textContent.trim();

    if (editType === 'title') {
      // Éditer le titre d'une section
      const sectionId = editableElement.dataset.sectionId;
      if (sectionId) {
        const section = findSectionById(sectionId, sectionsTree);
        if (section) {
          // Retirer la numérotation si présente
          const numbering = section.numbering || '';
          let cleanTitle = newText;
          if (numbering && cleanTitle.startsWith(numbering)) {
            cleanTitle = cleanTitle.substring(numbering.length).trim();
          }
          section.title = cleanTitle;
          // Recalculer la numérotation
          recalculateNumbering();
          // Re-render le sommaire pour mettre à jour les numéros
          renderSommaire();
        }
      }
    } else if (editType === 'paragraph') {
      // Éditer un paragraphe
      const paragraphId = editableElement.dataset.paragraphId;
      if (paragraphId) {
        // Trouver le paragraphe dans sectionsTree et mettre à jour son texte
        updateParagraphText(paragraphId, newText);
      }
    }
  }

  /**
   * Gère les touches spéciales lors de l'édition (Enter, Escape, ArrowDown)
   * @param {Event} e - Événement keydown
   */
  function handleTextEditKeydown(e) {
    const editableElement = e.target.closest('.editable-text');
    if (!editableElement) return;

    // Escape : annuler l'édition (recharger le texte original)
    if (e.key === 'Escape') {
      e.preventDefault();
      editableElement.blur();
      // Recharger le contenu pour restaurer le texte original
      renderContent();
      return;
    }

    // Enter dans un titre : empêcher le saut de ligne, juste blur
    if (editableElement.dataset.editType === 'title' && e.key === 'Enter') {
      e.preventDefault();
      editableElement.blur();
      return;
    }

    // Flèche du bas : passer au paragraphe suivant si on est en bas
    if (e.key === 'ArrowDown' && editableElement.dataset.editType === 'paragraph') {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      
      // Vérifier si on est à la fin du paragraphe
      const isAtEnd = range.endOffset === editableElement.textContent.length;
      
      if (isAtEnd) {
        // Trouver le paragraphe suivant
        const nextParagraph = findNextEditableElement(editableElement);
        if (nextParagraph) {
          e.preventDefault();
          // Focus sur le paragraphe suivant et placer le curseur au début
          nextParagraph.focus();
          const newRange = document.createRange();
          const selection = window.getSelection();
          newRange.setStart(nextParagraph, 0);
          newRange.setEnd(nextParagraph, 0);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }
    }

    // Flèche du haut : passer au paragraphe précédent si on est en haut
    if (e.key === 'ArrowUp' && editableElement.dataset.editType === 'paragraph') {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      
      // Vérifier si on est au début du paragraphe
      const isAtStart = range.startOffset === 0;
      
      if (isAtStart) {
        // Trouver le paragraphe précédent
        const prevParagraph = findPreviousEditableElement(editableElement);
        if (prevParagraph) {
          e.preventDefault();
          // Focus sur le paragraphe précédent et placer le curseur à la fin
          prevParagraph.focus();
          const newRange = document.createRange();
          const selection = window.getSelection();
          const textLength = prevParagraph.textContent.length;
          newRange.setStart(prevParagraph, textLength);
          newRange.setEnd(prevParagraph, textLength);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }
    }
  }

  /**
   * Trouve l'élément éditable suivant
   * @param {HTMLElement} currentElement - Élément actuel
   * @returns {HTMLElement|null} Élément suivant ou null
   */
  function findNextEditableElement(currentElement) {
    const contentArea = document.querySelector('[data-content-area]');
    if (!contentArea) return null;

    const allEditables = Array.from(contentArea.querySelectorAll('.editable-text[data-edit-type="paragraph"]'));
    const currentIndex = allEditables.indexOf(currentElement);
    
    if (currentIndex >= 0 && currentIndex < allEditables.length - 1) {
      return allEditables[currentIndex + 1];
    }
    
    return null;
  }

  /**
   * Trouve l'élément éditable précédent
   * @param {HTMLElement} currentElement - Élément actuel
   * @returns {HTMLElement|null} Élément précédent ou null
   */
  function findPreviousEditableElement(currentElement) {
    const contentArea = document.querySelector('[data-content-area]');
    if (!contentArea) return null;

    const allEditables = Array.from(contentArea.querySelectorAll('.editable-text[data-edit-type="paragraph"]'));
    const currentIndex = allEditables.indexOf(currentElement);
    
    if (currentIndex > 0) {
      return allEditables[currentIndex - 1];
    }
    
    return null;
  }

  /**
   * Met à jour le texte d'un paragraphe dans sectionsTree
   * @param {string} paragraphId - ID du paragraphe
   * @param {string} newText - Nouveau texte
   */
  function updateParagraphText(paragraphId, newText) {
    function findAndUpdateParagraph(sections) {
      for (const section of sections) {
        if (section.content && Array.isArray(section.content)) {
          for (const item of section.content) {
            if (item.id === paragraphId && item.type === 'paragraph') {
              item.text = newText;
              return true;
            }
          }
        }
        if (section.children && section.children.length > 0) {
          if (findAndUpdateParagraph(section.children)) {
            return true;
          }
        }
      }
      return false;
    }

    findAndUpdateParagraph(sectionsTree);
  }

  /**
   * Empêche le scroll global quand on arrive en haut d'une colonne
   */
  function attachScrollPrevention() {
    const scrollablePanels = document.querySelectorAll('.view-text.is-active .doc-panel__body');
    
    scrollablePanels.forEach(panel => {
      panel.addEventListener('wheel', (e) => {
        // Vérifier si on est en haut de la colonne et qu'on scroll vers le haut
        if (panel.scrollTop === 0 && e.deltaY < 0) {
          // Empêcher le scroll global
          e.preventDefault();
          e.stopPropagation();
        }
        // Vérifier si on est en bas de la colonne et qu'on scroll vers le bas
        else if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1 && e.deltaY > 0) {
          // Empêcher le scroll global
          e.preventDefault();
          e.stopPropagation();
        }
      }, { passive: false });
    });
  }

  /**
   * Initialisation
   */
  function init() {
    initViewTabs();
    initCardBackButton();
    initContextMenu();
    initSectionModal();
    initCanvasModal();
    loadDocument().then(() => {
      // Initialiser le canevas après le chargement du document
      initializeCanvasIfNeeded();
    });
  }

  init();
})();
