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
  const uploadSessionId = window.__UPLOAD_SESSION_ID || (window.__UPLOAD_SESSION_ID = generateUploadSessionId());

  let documentJson = null;
  let sectionsTree = [];
  let currentCardParent = null; // Pour la navigation dans les cards
  let selectedElement = null; // Élément actuellement sélectionné pour édition
  let dropMessageElement = null; // Message affiché pendant un drag & drop d'image
  let currentDropImageWrapper = null; // Image actuellement ciblée pour remplacement
  let globalDragCleanupRegistered = false; // Évite de dupliquer les listeners globaux

  /**
   * Stocke les marges de page Word pour les appliquer aux paragraphes
   */
  let pageMargins = { top: 70.85, right: 70.85, bottom: 70.85, left: 70.85 }; // Valeurs par défaut (2.5cm)
  
  function applyPageMargins(margins) {
    if (margins) {
      pageMargins = margins;
    }
  }

  function generateUploadSessionId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function buildDocumentImageUrl(imageName) {
    if (!imageName) return '';
    return `${apiBase}/agent-documentaire/document/${documentId}/image/${imageName}`;
  }

  function buildTempImageUrl(tempImageId) {
    if (!tempImageId) return '';
    return `${apiBase}/agent-documentaire/document/${documentId}/temp-image/${uploadSessionId}/${tempImageId}`;
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
      
      // Debug : analyser les sections chargées (désactivé par défaut, activer si besoin)
      // console.log('🔍 loadDocument - documentJson.sections:', documentJson.sections);
      // console.log('🔍 loadDocument - sectionsTree.length:', sectionsTree.length);
      
      // Debug : compter les sections optionnelles (désactivé par défaut)
      // const countOptional = (sections) => {
      //   let count = 0;
      //   sections.forEach(s => {
      //     if ((s.structure || 'structural') === 'optional') {
      //       count++;
      //     }
      //     if (Array.isArray(s.children)) {
      //       count += countOptional(s.children);
      //     }
      //   });
      //   return count;
      // };
      // const optionalCount = countOptional(sectionsTree);
      // console.log(`📊 loadDocument - Sections optionnelles dans sectionsTree: ${optionalCount}`);

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
      
      // Si l'onglet Options est actif dans le sidebar, recharger les options
      const optionsPanel = document.querySelector('[data-properties-panel="options"]');
      if (optionsPanel && optionsPanel.classList.contains('is-active')) {
        loadOptionsListSidebar();
      }

      // Vérifier si le template document existe et afficher le modal si nécessaire
      // Seulement au premier chargement
      if (!templateCheckDone) {
        await checkAndCreateDocumentTemplate(documentJson);
      }
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
   * Collecte toutes les sections à afficher (structurelles + optionnelles actives)
   * et les organise selon leur parent
   * @param {Array} sections - Arbre de sections
   * @returns {Array} Sections à afficher, organisées
   */
  function collectSectionsToRender(sections) {
    if (!Array.isArray(sections)) return [];

    const result = [];
    const optionalSectionsByParent = {}; // parentId -> [sections optionnelles]

    // Première passe : collecter les sections structurelles et les optionnelles actives
    const collectSections = (sections, parentId = null) => {
      sections.forEach(section => {
        const structure = section.structure || 'structural';
        const actif = section.actif !== undefined ? section.actif : (structure === 'structural' ? true : false);

        // Section structurelle : toujours inclure
        if (structure === 'structural' || structure === undefined) {
          const sectionCopy = { ...section };
          // Récursivement traiter les enfants
          if (Array.isArray(section.children)) {
            sectionCopy.children = collectSections(section.children, section.id);
          } else {
            sectionCopy.children = [];
          }
          result.push(sectionCopy);
        }
        // Section optionnelle active : ajouter à la liste par parent
        else if (structure === 'optional' && actif === true) {
          const parent = section.parent || null;
          const parentKey = parent || 'root';
          if (!optionalSectionsByParent[parentKey]) {
            optionalSectionsByParent[parentKey] = [];
          }
          optionalSectionsByParent[parentKey].push({ ...section });
        }

        // Traiter les enfants récursivement (même pour les optionnelles, au cas où)
        if (Array.isArray(section.children)) {
          collectSections(section.children, section.id);
        }
      });
    };

    collectSections(sections);

    // Deuxième passe : insérer les sections optionnelles sous leur parent
    const insertOptionalSections = (sections) => {
      sections.forEach(section => {
        // Si cette section a des sections optionnelles attachées
        const parentKey = section.id || 'root';
        if (optionalSectionsByParent[parentKey]) {
          // Insérer les sections optionnelles après les enfants structurels
          const optionalSections = optionalSectionsByParent[parentKey];
          if (!Array.isArray(section.children)) {
            section.children = [];
          }
          // Ajouter les sections optionnelles à la fin des enfants
          section.children.push(...optionalSections);
        }

        // Traiter récursivement les enfants
        if (Array.isArray(section.children)) {
          insertOptionalSections(section.children);
        }
      });

      // Gérer les sections optionnelles à la racine (parent = null ou '')
      if (optionalSectionsByParent['root']) {
        const rootOptionals = optionalSectionsByParent['root'];
        result.push(...rootOptionals);
      }
    };

    insertOptionalSections(result);

    return result;
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
    const paddingTopSource = canvasStyles?.marginTop ?? styles.marginTop ?? styles.spacing?.before;
    const paddingBottomSource = canvasStyles?.marginBottom ?? styles.marginBottom ?? styles.spacing?.after;

    if (paddingTopSource && paddingTopSource > 0) {
      cssProps.push(`padding-top: ${paddingTopSource}pt`);
    }
    if (paddingBottomSource && paddingBottomSource > 0) {
      cssProps.push(`padding-bottom: ${paddingBottomSource}pt`);
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
    
    // Vérifier si c'est un document réintégré
    const isDocument = section.isDocument || false;
    const documentId = section.documentId || null;

    let html = `<div id="${sectionId}" class="section level-${level} ${isDocument ? 'is-integrated-document' : ''}" data-section-id="${sectionId}" ${isDocument && documentId ? `data-integrated-document-id="${documentId}"` : ''}>`;
    
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
    } else if (isDocument && documentId) {
      // Document réintégré : charger et rendre le document
      html += `<div class="integrated-document-placeholder" data-document-id="${documentId}" data-section-id="${sectionId}">
        <p class="text-muted">Chargement du document réintégré...</p>
      </div>`;
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
        
        // Initialiser le verrouillage si absent (par défaut : hauteur verrouillée)
        if (!item.locked) {
          item.locked = { width: false, height: true };
        }
        
        const imageName = item.name || (imageSrc && !item.tempImageId ? (imageSrc.includes('/') ? imageSrc.split('/').pop() : imageSrc) : '');
        
        let imageUrl = '';
        if (item.tempImageId) {
          imageUrl = buildTempImageUrl(item.tempImageId);
        } else if (imageName) {
          imageUrl = buildDocumentImageUrl(imageName);
        } else if (imageSrc) {
          imageUrl = imageSrc;
        }
        
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

        if (item.inlineMargins) {
          if (item.inlineMargins.marginLeft !== undefined && item.inlineMargins.marginLeft !== '') {
            imgStyleProps.push(`margin-left: ${item.inlineMargins.marginLeft}`);
          }
          if (item.inlineMargins.marginRight !== undefined && item.inlineMargins.marginRight !== '') {
            imgStyleProps.push(`margin-right: ${item.inlineMargins.marginRight}`);
          }
          if (item.inlineMargins.display) {
            imgStyleProps.push(`display: ${item.inlineMargins.display}`);
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
          
          // Ajouter un ID unique pour identifier l'image dans sectionsTree
          const imageId = item.id || `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          if (!item.id) {
            item.id = imageId; // Sauvegarder l'ID dans l'item si absent
          }
          const imageIdAttr = ` data-image-id="${imageId}"`;
          
          if (containerStyles.length > 0) {
            html += `<div style="${containerStyles.join('; ')}">`;
            html += `<div class="image-wrapper" style="position: relative; display: inline-block;">`;
            html += `<img src="${imageUrl}" alt="${alt}"${imgStyleAttr}${transparencyAttr}${imageIdAttr} class="needs-transparency-processing" />`;
            html += `</div>`;
            html += `</div>`;
        } else {
          html += `<div class="image-wrapper" style="position: relative; display: inline-block;">`;
          html += `<img src="${imageUrl}" alt="${alt}"${imgStyleAttr}${transparencyAttr}${imageIdAttr} class="needs-transparency-processing" />`;
          html += `</div>`;
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

    // 2. Si position = 'inside', ajouter comme enfant de targetSection
    if (position === 'inside') {
      if (!Array.isArray(targetSection.children)) {
        targetSection.children = [];
      }
      targetSection.children.push(draggedSection);
      // Mettre à jour le niveau (enfant = niveau parent + 1)
      draggedSection.level = (targetSection.level || 0) + 1;
      updateChildrenLevels(draggedSection);
      return;
    }

    // 3. Sinon, insérer au même niveau (before ou after)
    const targetParent = findParentSection(targetSection.id, sectionsTree);
    const targetArray = targetParent ? targetParent.children : sectionsTree;
    
    // 4. Trouver l'index de targetSection
    const targetIndex = targetArray.findIndex(s => s.id === targetSection.id);
    
    if (targetIndex === -1) return;

    // 5. Insérer draggedSection à la bonne position
    if (position === 'before') {
      targetArray.splice(targetIndex, 0, draggedSection);
    } else { // after
      targetArray.splice(targetIndex + 1, 0, draggedSection);
    }

    // 6. Mettre à jour le niveau de draggedSection (même niveau que targetSection)
    draggedSection.level = targetSection.level || 0;
    updateChildrenLevels(draggedSection);
  }

  /**
   * Retire une section de l'arbre
   */
  function removeSectionFromTree(section) {
    // Chercher dans la hiérarchie normale
    const parent = findParentSection(section.id, sectionsTree);
    const array = parent ? parent.children : sectionsTree;
    const index = array.findIndex(s => s.id === section.id);
    
    if (index !== -1) {
      array.splice(index, 1);
      return true;
    }
    
    // Si pas trouvé, chercher à la racine (pour les options qui sont à la racine)
    const rootIndex = sectionsTree.findIndex(s => s.id === section.id);
    if (rootIndex !== -1) {
      sectionsTree.splice(rootIndex, 1);
      return true;
    }
    
    return false;
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
   * Change la structure d'une section localement (sans sauvegarder)
   * Simule la logique du backend mais en mémoire uniquement
   */
  function changeSectionStructureLocal(sectionId, newStructure, parentId = null, category = null) {
    const section = findSectionById(sectionId, sectionsTree);
    if (!section) {
      console.warn(`⚠️ Section ${sectionId} non trouvée`);
      return false;
    }
    const oldStructure = section.structure || 'structural';

    // Normaliser category en tableau
    let normalizedCategory = null;
    if (newStructure === 'optional' && category) {
      normalizedCategory = Array.isArray(category) ? category : [category];
      normalizedCategory = normalizedCategory.filter(c => c && c.trim());
      if (normalizedCategory.length === 0) {
        console.warn('⚠️ Catégorie vide, utilisation de "dossier technique" par défaut');
        normalizedCategory = ['dossier technique'];
      }
    }

    // Si on passe de structural à optional
    if (oldStructure === 'structural' && newStructure === 'optional') {
      // Retirer de son parent actuel
      removeSectionFromTree(section);
      
      // Mettre à jour les champs
      section.structure = 'optional';
      section.actif = false; // Par défaut désactivé
      section.parent = parentId;
      section.category = normalizedCategory;
      
      // Garder la section optionnelle à la racine pour qu'elle reste accessible
      const isAtRoot = sectionsTree.some(s => s.id === sectionId);
      if (!isAtRoot) {
        sectionsTree.push(section);
      }
    }
    // Si on passe de optional à structural
    else if (oldStructure === 'optional' && newStructure === 'structural') {
      const oldParentId = section.parent;
      removeSectionFromTree(section);
      
      // Réintégrer
      if (parentId !== null) {
        const parent = findSectionById(parentId, sectionsTree);
        if (parent) {
          if (!Array.isArray(parent.children)) {
            parent.children = [];
          }
          parent.children.push(section);
        } else {
          sectionsTree.push(section);
        }
      } else if (oldParentId) {
        const oldParent = findSectionById(oldParentId, sectionsTree);
        if (oldParent) {
          if (!Array.isArray(oldParent.children)) {
            oldParent.children = [];
          }
          oldParent.children.push(section);
        } else {
          sectionsTree.push(section);
        }
      } else {
        sectionsTree.push(section);
      }
      
      // Mettre à jour les champs
      section.structure = 'structural';
      section.actif = true; // Forcé à true pour structural
      section.parent = null;
      section.category = null;
    }
    // Si on change juste le parent ou la catégorie d'une option
    else if (oldStructure === 'optional' && newStructure === 'optional') {
      section.parent = parentId;
      if (normalizedCategory !== null) {
        section.category = normalizedCategory;
      }
    }

    // Recalculer la numérotation
    recalculateNumbering();

    return true;
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

    // Collecter toutes les sections à afficher (structurelles + optionnelles actives)
    const sectionsToRender = collectSectionsToRender(sectionsTree);

    let html = '';
    sectionsToRender.forEach(section => {
      html += generateSectionHTML(section, section.level || 1);
    });

    contentArea.innerHTML = html || '<p class="text-muted">Aucun contenu</p>';
    
    // Traiter les images qui ont besoin de transparence
    processImageTransparency();
    
    // Ajuster les dimensions des wrappers pour les images avec rotation initiale
    adjustImageWrappersForRotation();
    
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
      // Initialiser le rognage d'image
      initImageCrop();
      // Charger les documents réintégrés
      loadIntegratedDocuments();
      // Réajuster les wrappers après un délai pour les images qui se chargent lentement
      setTimeout(() => {
        adjustImageWrappersForRotation();
        // Réessayer après un délai supplémentaire pour les images très lentes
        setTimeout(() => {
          adjustImageWrappersForRotation();
        }, 500);
      }, 200);
    }, 100);

    // Initialiser le drag & drop d'images
    initContentDragAndDrop();
  }

  /**
   * Initialise le drag & drop d'images dans la zone de contenu
   */
  function initContentDragAndDrop() {
    const contentArea = document.querySelector('[data-content-area]');
    if (!contentArea) return;

    // Éviter d'attacher plusieurs fois les mêmes événements
    if (contentArea.dataset.dndInitialized === 'true') {
      return;
    }
    contentArea.dataset.dndInitialized = 'true';

    contentArea.addEventListener('dragenter', handleContentDragEnter);
    contentArea.addEventListener('dragover', handleContentDragOver);
    contentArea.addEventListener('dragleave', handleContentDragLeave);
    contentArea.addEventListener('drop', handleContentDrop);

    createMobileUploadTrigger(contentArea);

    if (!globalDragCleanupRegistered) {
      document.addEventListener('dragend', resetDropVisualState, true);
      document.addEventListener('drop', resetDropVisualState, true);
      globalDragCleanupRegistered = true;
    }
  }

  function handleContentDragEnter(e) {
    e.preventDefault();

    if (!hasExternalImage(e)) {
      // Autoriser le drop sur les images même si le navigateur ne fournit pas de fichiers (ex: drag interne)
      const targetImage = e.target.closest('.image-wrapper');
      if (!targetImage) {
        return;
      }
    }
    const contentArea = e.currentTarget;
    contentArea.classList.add('is-dropping');

    const targetImage = e.target.closest('.image-wrapper');
    if (targetImage) {
      highlightDropTarget(targetImage, 'replace');
      showDropMessage('replace');
    } else {
      highlightDropTarget(null);
      showDropMessage('add');
    }
  }

  function handleContentDragOver(e) {
    e.preventDefault();

    if (!hasExternalImage(e)) {
      const targetImage = e.target.closest('.image-wrapper');
      if (!targetImage) {
        return;
      }
    }

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }

    const targetImage = e.target.closest('.image-wrapper');
    if (targetImage) {
      highlightDropTarget(targetImage, 'replace');
      showDropMessage('replace');
    } else {
      highlightDropTarget(null);
      showDropMessage('add');
    }
  }

  function handleContentDragLeave(e) {
    if (!hasExternalImage(e) && !e.target.closest('.image-wrapper')) return;
    const contentArea = e.currentTarget;

    // Vérifier si on quitte réellement la zone
    if (!contentArea.contains(e.relatedTarget)) {
      resetDropVisualState();
    }
  }

  async function handleContentDrop(e) {
    e.preventDefault();
    const targetImageWrapper = e.target.closest('.image-wrapper');
    if (!hasExternalImage(e) && !targetImageWrapper) {
      return;
    }

    const contentArea = e.currentTarget;
    const sectionElement = e.target.closest('.section') || contentArea.querySelector('.section');
    const imageElement = targetImageWrapper?.querySelector('img') || null;
    const replaceImageData = imageElement ? findImageDataFromElement(imageElement) : null;
    const preservedDisplayState = captureImageDisplayState(imageElement, replaceImageData);

    resetDropVisualState();

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await handleImageFileDrop(files[0], { imageElement, sectionElement, preservedDisplayState });
      return;
    }

    const uriData = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
    if (uriData) {
      await handleImageUrlDrop(uriData, { imageElement, sectionElement, preservedDisplayState });
    }
  }

  function hasExternalImage(event) {
    const dt = event.dataTransfer;
    if (!dt) return false;
    if (dt.files && dt.files.length > 0) {
      return Array.from(dt.files).some(file => file.type && file.type.startsWith('image/'));
    }
    if (dt.types && (dt.types.includes('text/uri-list') || dt.types.includes('text/plain'))) {
      return true;
    }
    return false;
  }

  async function handleImageFileDrop(file, context = {}) {
    if (!file || !file.type.startsWith('image/')) {
      console.warn('❌ Le fichier déposé n\'est pas une image.');
      return;
    }

    try {
      showDropMessage('upload');
      const dimensions = await getImageDimensionsFromFile(file);
      console.log('🔍 DEBUG handleImageFileDrop - dimensions récupérées:');
      console.log('  dimensions.width:', dimensions.width);
      console.log('  dimensions.height:', dimensions.height);
      console.log('  ratio calculé:', dimensions.width / dimensions.height);
      const replaceImageData = context.imageElement ? findImageDataFromElement(context.imageElement) : null;
      const replaceImageName = replaceImageData ? (replaceImageData.name || replaceImageData.src || null) : null;

      // Logs image cible (avant drop)
      if (replaceImageData && context.imageElement) {
        const targetImg = context.imageElement;
        const targetComputed = window.getComputedStyle(targetImg);
        const targetWrapper = targetImg.closest('.image-wrapper');
        const targetWrapperComputed = targetWrapper ? window.getComputedStyle(targetWrapper) : null;
        const targetName = replaceImageData.name || replaceImageData.src || 'sans nom';
        const targetHeight = targetComputed.height || targetImg.style.height || 'auto';
        const targetWidth = targetComputed.width || targetImg.style.width || 'auto';
        let targetJustification = targetWrapperComputed?.textAlign || targetWrapper?.style?.textAlign || '';
        if (!targetJustification) {
          const ml = targetComputed.marginLeft;
          const mr = targetComputed.marginRight;
          if (ml === 'auto' && mr === 'auto') {
            targetJustification = 'center';
          } else if (ml === 'auto') {
            targetJustification = 'right';
          } else if (mr === 'auto') {
            targetJustification = 'left';
          } else {
            targetJustification = 'left (par défaut)';
          }
        }
        console.log('📋 DRAG & DROP - Image cible:');
        console.log('  Nom:', targetName);
        console.log('  Hauteur:', targetHeight);
        console.log('  Largeur:', targetWidth);
        console.log('  Justification:', targetJustification);
      }

      const uploadResult = await uploadImage(file, replaceImageName);
      const result = applyImageUploadResult(uploadResult, dimensions, context, replaceImageData);
      if (context.imageElement && result) {
        updateImageElementPreview(context.imageElement, result.previewUrl, result.dimensions, result.imageData || replaceImageData);
      }
      hideDropMessage();
      renderContent();
    } catch (error) {
      console.error('❌ Erreur import image:', error);
      hideDropMessage();
      alert(error.message || 'Erreur lors de l\'import de l\'image.');
    }
  }

  async function handleImageUrlDrop(url, context = {}) {
    if (!url) return;
    try {
      showDropMessage('upload');
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Impossible de récupérer l\'image.');
      }
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) {
        throw new Error('Le contenu déposé n\'est pas une image.');
      }
      const filename = url.split('/').pop()?.split('?')[0] || 'image-externe.png';
      let file;
      if (typeof File === 'function') {
        file = new File([blob], filename, { type: blob.type });
      } else {
        blob.name = filename;
        file = blob;
      }
      await handleImageFileDrop(file, context);
    } catch (error) {
      console.error('❌ Erreur import URL:', error);
      hideDropMessage();
      alert(error.message || 'Impossible d\'importer cette image.');
    }
  }

  function captureImageDisplayState(imgElement, imageData = null) {
    if (!imgElement) return null;
    let imgComputed = null;
    let wrapperComputed = null;
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      try {
        imgComputed = window.getComputedStyle(imgElement);
      } catch (error) {
        console.warn('⚠️ Impossible de récupérer le style calculé de l’image :', error);
      }
    }
    const wrapper = imgElement.closest('.image-wrapper');
    if (wrapper && typeof window !== 'undefined' && window.getComputedStyle) {
      try {
        wrapperComputed = window.getComputedStyle(wrapper);
      } catch (error) {
        console.warn('⚠️ Impossible de récupérer le style du wrapper :', error);
      }
    }

    const marginLeft = imgComputed?.marginLeft ?? imgElement.style.marginLeft ?? '';
    const marginRight = imgComputed?.marginRight ?? imgElement.style.marginRight ?? '';
    let alignment = wrapperComputed?.textAlign || wrapper?.style?.textAlign || '';
    if (!alignment) {
      if (marginLeft === 'auto' && marginRight === 'auto') {
        alignment = 'center';
      } else if ((marginLeft === 'auto' && marginRight === '0px') || (marginLeft === 'auto' && marginRight === '0')) {
        alignment = 'right';
      } else if ((marginRight === 'auto' && marginLeft === '0px') || (marginRight === 'auto' && marginLeft === '0')) {
        alignment = 'left';
      }
    }

    const measuredHeight = (() => {
      const rect = imgElement.getBoundingClientRect ? imgElement.getBoundingClientRect() : null;
      if (rect && rect.height) return `${rect.height}px`;
      if (imgElement.offsetHeight) return `${imgElement.offsetHeight}px`;
      return '';
    })();

    const capturedHeight = (imgComputed?.height && imgComputed.height !== 'auto') ? imgComputed.height : (imgElement.style.height || measuredHeight || '');
    const capturedWidth = imgComputed?.width ?? imgElement.style.width ?? '';
    
    // Extraire la rotation depuis transform
    let capturedRotation = '';
    const transform = imgComputed?.transform || imgElement.style.transform || '';
    if (transform && transform.includes('rotate')) {
      const match = transform.match(/rotate\(([^)]+)\)/);
      if (match) {
        capturedRotation = match[1].trim();
      }
    }
    // Si pas dans transform, vérifier dans imageData.rotation
    if (!capturedRotation && imageData && imageData.rotation) {
      capturedRotation = imageData.rotation;
    }
    
    console.log('🔍 DEBUG captureImageDisplayState:');
    console.log('  imgComputed.height:', imgComputed?.height);
    console.log('  imgElement.style.height:', imgElement.style.height);
    console.log('  measuredHeight:', measuredHeight);
    console.log('  capturedHeight:', capturedHeight);
    console.log('  capturedWidth:', capturedWidth);
    console.log('  alignment:', alignment || '(vide)');
    console.log('  capturedRotation:', capturedRotation || '(vide)');

    return {
      width: capturedWidth,
      height: capturedHeight,
      marginLeft,
      marginRight,
      display: imgComputed?.display ?? imgElement.style.display ?? '',
      textAlign: alignment || '',
      rotation: capturedRotation || ''
    };
  }

  function parseLengthToPx(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string' && value.trim().toLowerCase() === 'auto') {
      return null;
    }
    if (typeof value === 'number') return value;
    const trimmed = value.toString().trim();
    if (!trimmed) return null;
    const numeric = parseFloat(trimmed);
    if (isNaN(numeric)) return null;
    if (trimmed.endsWith('pt')) {
      const result = numeric * (96 / 72);
      console.log('🔍 parseLengthToPx:', value, '→', result, '(pt→px)');
      return result;
    }
    console.log('🔍 parseLengthToPx:', value, '→', numeric);
    return numeric;
  }

  async function uploadImage(file, replaceImageName = null) {
    if (!documentId || !apiBase) {
      throw new Error('Document non initialisé.');
    }
    if (!documentJson) {
      throw new Error('Document non chargé.');
    }
    const url = `${apiBase}/agent-documentaire/document/${documentId}/image/temp`;
    const formData = new FormData();
    formData.append('image', file, file.name || 'image.png');
    formData.append('sessionId', uploadSessionId);
    if (replaceImageName) {
      formData.append('replaceImageName', replaceImageName);
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || 'Import impossible.');
    }
    const tempImageId = payload.data.tempImageId;
    return {
      tempImageId,
      previewUrl: buildTempImageUrl(tempImageId),
      originalName: file.name || 'image',
      mimeType: file.type || payload.data.mimeType || 'image/png'
    };
  }

  function applyImageUploadResult(uploadResult, dimensions, context, replaceImageData) {
    if (replaceImageData) {
      return applyUploadedImageToExisting(replaceImageData, uploadResult, dimensions, context);
    }
    return insertNewImageIntoSection(uploadResult, dimensions, context.sectionElement);
  }

  function applyUploadedImageToExisting(imageData, uploadResult, dimensions, context = {}) {
    if (!imageData) return null;
    
    // Ne pas initialiser locked si l'utilisateur n'a jamais touché aux verrous
    // On considère qu'il n'y a pas de verrous actifs si locked n'existe pas ou si userOverride n'est pas défini
    const hasUserSetLocks = imageData.locked && imageData.locked.userOverride === true;
    const widthLocked = hasUserSetLocks && imageData.locked.width === true;
    const heightLocked = hasUserSetLocks && imageData.locked.height === true;
    const noLocksActive = !widthLocked && !heightLocked;
    
    // Si locked n'existe pas, on le crée mais sans forcer height: true
    if (!imageData.locked) {
      imageData.locked = { width: false, height: false };
    }
    
    const defaultLockState = imageData.locked.width === false && imageData.locked.height === true && !imageData.locked.userOverride;
    const previousHeight = imageData.height;
    const normalizedPrevHeight = typeof previousHeight === 'string'
      ? parseFloat(previousHeight)
      : typeof previousHeight === 'number'
        ? previousHeight
        : null;
    const preservedDisplayState = context?.preservedDisplayState || null;
    const preservedHeightPx = preservedDisplayState ? parseLengthToPx(preservedDisplayState.height) : null;
    const domMeasuredHeight = context?.imageElement
      ? (context.imageElement.getBoundingClientRect?.().height || context.imageElement.offsetHeight || null)
      : null;
    
    // Logs de debug pour comprendre ce qui se passe
    console.log('🔍 DEBUG applyUploadedImageToExisting:');
    console.log('  hasUserSetLocks:', hasUserSetLocks);
    console.log('  widthLocked:', widthLocked);
    console.log('  heightLocked:', heightLocked);
    console.log('  noLocksActive:', noLocksActive);
    console.log('  normalizedPrevHeight:', normalizedPrevHeight);
    console.log('  preservedHeightPx:', preservedHeightPx);
    console.log('  domMeasuredHeight:', domMeasuredHeight);

    // Récupérer la justification depuis preservedDisplayState en priorité (c'est le plus fiable)
    let preservedAlignment = preservedDisplayState?.textAlign || '';
    if (!preservedAlignment && imageData.textAlign) {
      preservedAlignment = imageData.textAlign;
    }
    if (!preservedAlignment && context?.imageElement) {
      // Chercher dans le wrapper parent
      const wrapper = context.imageElement.closest('.image-wrapper');
      if (wrapper) {
        const wrapperComputed = window.getComputedStyle(wrapper);
        preservedAlignment = wrapperComputed.textAlign || wrapper.style.textAlign || '';
      }
      // Si toujours rien, chercher dans le parent du wrapper
      if (!preservedAlignment && wrapper && wrapper.parentElement) {
        const parentComputed = window.getComputedStyle(wrapper.parentElement);
        preservedAlignment = parentComputed.textAlign || wrapper.parentElement.style.textAlign || '';
      }
    }
    // Si on a détecté "center" via les marges auto, le sauvegarder
    if (!preservedAlignment && preservedDisplayState) {
      const ml = preservedDisplayState.marginLeft;
      const mr = preservedDisplayState.marginRight;
      if (ml === 'auto' && mr === 'auto') {
        preservedAlignment = 'center';
      } else if (ml === 'auto') {
        preservedAlignment = 'right';
      } else if (mr === 'auto') {
        preservedAlignment = 'left';
      }
    }
    // Ne pas écraser avec une valeur vide
    if (preservedAlignment && preservedAlignment !== 'justify') {
      imageData.textAlign = preservedAlignment;
    }
    if (preservedDisplayState) {
      imageData.inlineMargins = {
        marginLeft: preservedDisplayState.marginLeft ?? '',
        marginRight: preservedDisplayState.marginRight ?? '',
        display: preservedDisplayState.display ?? ''
      };
      // Conserver la rotation de l'image cible
      // Priorité : preservedDisplayState.rotation > imageData.rotation
      if (preservedDisplayState.rotation) {
        imageData.rotation = preservedDisplayState.rotation;
      } else if (imageData.rotation) {
        // Si pas dans preservedDisplayState mais présent dans imageData, on le garde
        // (déjà présent dans imageData, rien à faire)
      }
    } else if (imageData.rotation) {
      // Si preservedDisplayState n'existe pas mais qu'on a une rotation dans imageData, on la garde
      // (déjà présent dans imageData, rien à faire)
    }

    imageData.tempImageId = uploadResult.tempImageId;
    imageData.pendingOriginalName = uploadResult.originalName || imageData.pendingOriginalName || imageData.name;
    imageData.pendingReplaceName = imageData.name || null;
    imageData.previewUrl = uploadResult.previewUrl;
    imageData.src = uploadResult.previewUrl;
    // Stocker l'URL originale pour le rognage (ne sera jamais modifiée)
    if (!imageData.originalSrc) {
      imageData.originalSrc = uploadResult.previewUrl;
    }

    // Logs des dimensions de la nouvelle image
    console.log('🔍 DEBUG dimensions nouvelle image:');
    console.log('  dimensions.width:', dimensions?.width);
    console.log('  dimensions.height:', dimensions?.height);
    console.log('  dimensions object:', dimensions);

    const computed = computeDimensionsWithLocks(imageData, dimensions);
    
    // Calculer le ratio de la NOUVELLE IMAGE (pour éviter la déformation)
    // Utiliser les dimensions NATURELLES de la nouvelle image (pas celles modifiées par computeDimensionsWithLocks)
    const newImageAspectRatio = (dimensions?.width && dimensions?.height && dimensions.height > 0)
      ? dimensions.width / dimensions.height
      : null;
    
    console.log('🔍 DEBUG ratio calculé:');
    console.log('  newImageAspectRatio:', newImageAspectRatio);
    console.log('  computed.width:', computed.width);
    console.log('  computed.height:', computed.height);

    let resolvedWidth = computed.width;
    let resolvedHeight = defaultLockState ? (normalizedPrevHeight ?? computed.height) : computed.height;

    if (noLocksActive && newImageAspectRatio && isFinite(newImageAspectRatio) && newImageAspectRatio > 0) {
      const fallbackDomHeight = domMeasuredHeight && !isNaN(domMeasuredHeight) ? domMeasuredHeight : null;
      const targetHeight = normalizedPrevHeight ?? preservedHeightPx ?? fallbackDomHeight;
      console.log('🔍 DEBUG conservation hauteur (noLocksActive):');
      console.log('  targetHeight calculé:', targetHeight);
      console.log('  newImageAspectRatio (ratio nouvelle image):', newImageAspectRatio);
      console.log('  dimensions.width:', dimensions.width);
      console.log('  dimensions.height:', dimensions.height);
      if (targetHeight !== null && !isNaN(targetHeight)) {
        // CONSERVER la hauteur cible (ne JAMAIS la recalculer)
        resolvedHeight = Math.max(1, Math.round(targetHeight));
        // Calculer la largeur avec le RATIO DE LA NOUVELLE IMAGE (pour éviter la déformation)
        // On IGNORE la limite de largeur pour respecter le ratio et garder la hauteur
        resolvedWidth = Math.max(1, Math.round(resolvedHeight * newImageAspectRatio));
        console.log('  candidateWidth (hauteur * ratio nouvelle image):', resolvedWidth);
        console.log('  ✅ Hauteur CONSERVÉE:', resolvedHeight, 'Largeur (ratio respecté, limite ignorée):', resolvedWidth);
      } else {
        console.log('  ❌ Impossible de conserver la hauteur - targetHeight invalide');
      }
    } else {
      console.log('🔍 DEBUG conservation hauteur (verrous actifs ou pas de ratio):');
      console.log('  noLocksActive:', noLocksActive);
      console.log('  newImageAspectRatio:', newImageAspectRatio);
      console.log('  Utilisation computed.height:', computed.height);
    }

    console.log('🔍 DEBUG avant assignation finale:');
    console.log('  resolvedWidth:', resolvedWidth);
    console.log('  resolvedHeight:', resolvedHeight);
    console.log('  computed.width:', computed.width);
    console.log('  computed.height:', computed.height);
    
    imageData.width = resolvedWidth;
    imageData.height = resolvedHeight;
    
    console.log('🔍 DEBUG après assignation:');
    console.log('  imageData.width:', imageData.width);
    console.log('  imageData.height:', imageData.height);

    // Logs image finale (après drop)
    const finalName = uploadResult.originalName || imageData.name || imageData.src || 'sans nom';
    const finalHeight = `${resolvedHeight}px`;
    const finalWidth = `${resolvedWidth}px`;
    let finalJustification = imageData.textAlign || '';
    if (!finalJustification && imageData.inlineMargins) {
      const ml = imageData.inlineMargins.marginLeft;
      const mr = imageData.inlineMargins.marginRight;
      if (ml === 'auto' && mr === 'auto') {
        finalJustification = 'center';
      } else if (ml === 'auto') {
        finalJustification = 'right';
      } else if (mr === 'auto') {
        finalJustification = 'left';
      } else {
        finalJustification = 'left (par défaut)';
      }
    }
    if (!finalJustification) {
      finalJustification = 'left (par défaut)';
    }
    console.log('📋 DRAG & DROP - Image lâchée (finale):');
    console.log('  Nom:', finalName);
    console.log('  Hauteur:', finalHeight);
    console.log('  Largeur:', finalWidth);
    console.log('  Justification:', finalJustification);

    return {
      dimensions: {
        width: resolvedWidth,
        height: resolvedHeight
      },
      previewUrl: uploadResult.previewUrl,
      imageData
    };
  }

  function insertNewImageIntoSection(uploadResult, dimensions, sectionElement) {
    const sectionId = sectionElement?.dataset.sectionId;
    const targetSection = sectionId ? findSectionById(sectionId, sectionsTree) : sectionsTree[0];

    if (!targetSection) {
      console.warn('⚠️ Impossible d\'insérer l\'image : aucune section cible.');
      return;
    }

    if (!Array.isArray(targetSection.content)) {
      targetSection.content = [];
    }

    const newImage = {
      type: 'image',
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      src: uploadResult.previewUrl,
      name: uploadResult.originalName || '',
      tempImageId: uploadResult.tempImageId,
      pendingOriginalName: uploadResult.originalName || '',
      alt: 'Image',
      width: dimensions.width,
      height: dimensions.height,
      locked: { width: false, height: true },
      textAlign: '',
      paragraphBackgroundColor: '',
    };

    const computed = computeDimensionsWithLocks(newImage, dimensions);
    newImage.width = computed.width;
    newImage.height = computed.height;

    // Logs image finale (nouvelle image, pas de remplacement)
    const finalName = uploadResult.originalName || newImage.name || 'sans nom';
    const finalHeight = `${computed.height}px`;
    const finalWidth = `${computed.width}px`;
    const finalJustification = newImage.textAlign || 'left (par défaut)';
    console.log('📋 DRAG & DROP - Image lâchée (nouvelle image):');
    console.log('  Nom:', finalName);
    console.log('  Hauteur:', finalHeight);
    console.log('  Largeur:', finalWidth);
    console.log('  Justification:', finalJustification);

    targetSection.content.push(newImage);

    return { dimensions: computed, previewUrl: uploadResult.previewUrl, imageId: newImage.id, imageData: newImage };
  }

  function computeDimensionsWithLocks(imageData, naturalDimensions = {}) {
    const locked = {
      width: false,
      height: true,
      ...(imageData.locked || {})
    };

    const naturalWidth = naturalDimensions.width || imageData.width || 0;
    const naturalHeight = naturalDimensions.height || imageData.height || 0;

    if (!naturalWidth || !naturalHeight) {
      return {
        width: imageData.width || 0,
        height: imageData.height || 0
      };
    }

    const aspectRatio = naturalWidth / naturalHeight;
    let width = imageData.width || naturalWidth;
    let height = imageData.height || naturalHeight;

    if (locked.width && !locked.height) {
      width = imageData.width || naturalWidth;
      height = Math.round(width / aspectRatio);
    } else if (locked.height && !locked.width) {
      height = imageData.height || naturalHeight;
      width = Math.round(height * aspectRatio);
    } else if (!locked.width && !locked.height) {
      width = clampImageWidth(naturalWidth);
      height = Math.round(width / aspectRatio);
    } else {
      // Les deux verrouillés : respecter la largeur et ajuster la hauteur pour garder le ratio
      width = imageData.width || naturalWidth;
      height = Math.round(width / aspectRatio);
    }

    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height))
    };
  }

  function clampImageWidth(value) {
    const defaultMax = documentJson?.canvas?.images?.default?.maxWidth;
    const numericMax = typeof defaultMax === 'string'
      ? parseFloat(defaultMax)
      : (typeof defaultMax === 'number' ? defaultMax : null);

    const limit = !isNaN(numericMax) && numericMax > 0 ? numericMax : 720;
    const result = Math.min(value, limit);
    console.log('🔍 clampImageWidth:', value, '→', result, '(limit:', limit, ')');
    return result;
  }

  function updateImageElementPreview(imgElement, previewUrl, dimensions, imageData = null) {
    if (!imgElement) return;
    if (previewUrl) {
      imgElement.src = previewUrl;
    }
    if (dimensions) {
      if (dimensions.width) {
        imgElement.style.width = `${dimensions.width}px`;
      }
      if (dimensions.height) {
        imgElement.style.height = `${dimensions.height}px`;
      }
    }

    const wrapper = imgElement.closest('.image-wrapper');
    const alignment = imageData?.textAlign || '';
    if (wrapper && alignment) {
      if (alignment === 'center') {
        wrapper.style.display = 'block';
        wrapper.style.textAlign = 'center';
        imgElement.style.display = 'inline-block';
        imgElement.style.marginLeft = 'auto';
        imgElement.style.marginRight = 'auto';
      } else if (alignment === 'right') {
        wrapper.style.display = 'block';
        wrapper.style.textAlign = 'right';
        imgElement.style.display = 'inline-block';
        imgElement.style.marginLeft = 'auto';
        imgElement.style.marginRight = '0';
      } else if (alignment === 'left') {
        wrapper.style.display = 'block';
        wrapper.style.textAlign = 'left';
        imgElement.style.display = 'inline-block';
        imgElement.style.marginLeft = '0';
        imgElement.style.marginRight = 'auto';
      } else {
        wrapper.style.textAlign = alignment;
      }
    }
    if (imageData?.inlineMargins) {
      if (imageData.inlineMargins.marginLeft !== undefined) {
        imgElement.style.marginLeft = imageData.inlineMargins.marginLeft || '';
      }
      if (imageData.inlineMargins.marginRight !== undefined) {
        imgElement.style.marginRight = imageData.inlineMargins.marginRight || '';
      }
      if (imageData.inlineMargins.display) {
        imgElement.style.display = imageData.inlineMargins.display;
      }
    }
  }

  function collectTempImageMappings() {
    const mappings = [];

    function traverseSections(sections) {
      if (!Array.isArray(sections)) return;
      sections.forEach(section => {
        if (section.content && Array.isArray(section.content)) {
          section.content.forEach(item => {
            if (item.type === 'image' && item.tempImageId) {
              mappings.push({
                tempImageId: item.tempImageId,
                targetImageId: item.id,
                originalName: item.pendingOriginalName || item.name || 'image',
                replaceImageName: item.pendingReplaceName || null
              });
            }
          });
        }
        if (section.children && section.children.length > 0) {
          traverseSections(section.children);
        }
      });
    }

    traverseSections(sectionsTree);
    return mappings;
  }

  async function promoteTempImages(tempImageMappings) {
    if (!tempImageMappings || tempImageMappings.length === 0) {
      return [];
    }

    const url = `${apiBase}/agent-documentaire/document/${documentId}/images/promote`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: uploadSessionId,
        images: tempImageMappings
      })
    });
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || 'Promotion des images impossible.');
    }
    return payload.data || [];
  }

  function applyPromotionResults(results = []) {
    if (!Array.isArray(results) || results.length === 0) {
      return;
    }

    results.forEach(result => {
      const imageData = findImageById(result.targetImageId);
      if (!imageData) {
        return;
      }
      imageData.name = result.finalName;
      imageData.src = result.finalName;
      delete imageData.tempImageId;
      delete imageData.pendingOriginalName;
      delete imageData.pendingReplaceName;
      delete imageData.previewUrl;
    });
  }

  async function saveDocumentChanges() {
    if (!documentId || !apiBase) {
      throw new Error('Document non initialisé.');
    }

    const tempMappings = collectTempImageMappings();
    if (tempMappings.length > 0) {
      const promotionResults = await promoteTempImages(tempMappings);
      applyPromotionResults(promotionResults);
    }

    // Recalculer la numérotation avant de sauvegarder
    recalculateNumbering();

    documentJson.sections = sectionsTree;

    const response = await fetch(`${apiBase}/agent-documentaire/document/${documentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ json_content: documentJson })
    });

    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || 'Sauvegarde impossible.');
    }

    if (payload.data?.json_content) {
      documentJson = payload.data.json_content;
      sectionsTree = Array.isArray(documentJson.sections) ? documentJson.sections : sectionsTree;
    }

    renderContent();
  }

  function initSaveButton() {
    const saveBtn = document.getElementById('saveDocumentBtn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
      const initialLabel = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Sauvegarde...';

      try {
        await saveDocumentChanges();
        saveBtn.textContent = 'Enregistré ✅';
        setTimeout(() => {
          saveBtn.textContent = initialLabel;
        }, 1500);
      } catch (error) {
        console.error('Erreur sauvegarde document:', error);
        alert(error.message || 'Erreur lors de la sauvegarde.');
        saveBtn.textContent = initialLabel;
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  function showDropMessage(type) {
    const contentArea = document.querySelector('[data-content-area]');
    if (!contentArea) return;

    if (dropMessageElement && !dropMessageElement.isConnected) {
      dropMessageElement = null;
    }

    if (!dropMessageElement) {
      dropMessageElement = document.createElement('div');
      dropMessageElement.className = 'content-drop-message';
      contentArea.appendChild(dropMessageElement);
    }

    if (type === 'replace') {
      dropMessageElement.textContent = 'Relâchez pour remplacer l’image';
    } else if (type === 'upload') {
      dropMessageElement.textContent = 'Import de l’image en cours...';
    } else {
      dropMessageElement.textContent = 'Relâchez pour ajouter une image';
    }

    dropMessageElement.classList.add('is-visible');
  }

  function hideDropMessage() {
    if (dropMessageElement) {
      dropMessageElement.classList.remove('is-visible');
    }
  }

  function highlightDropTarget(wrapper, mode = 'add') {
    if (currentDropImageWrapper && currentDropImageWrapper !== wrapper) {
      currentDropImageWrapper.classList.remove('is-drop-target', 'is-drop-replace');
    }

    currentDropImageWrapper = wrapper || null;
    if (!currentDropImageWrapper) {
      return;
    }

    currentDropImageWrapper.classList.remove('is-drop-target', 'is-drop-replace');
    currentDropImageWrapper.classList.add(mode === 'replace' ? 'is-drop-replace' : 'is-drop-target');
  }

  function resetDropVisualState() {
    const contentArea = document.querySelector('[data-content-area]');
    if (contentArea) {
      contentArea.classList.remove('is-dropping');
    }
    if (currentDropImageWrapper) {
      currentDropImageWrapper.classList.remove('is-drop-target', 'is-drop-replace');
      currentDropImageWrapper = null;
    }
    hideDropMessage();
  }

  function createMobileUploadTrigger(contentArea) {
    if (!window.matchMedia) {
      return;
    }
    const prefersCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    if (!prefersCoarsePointer) {
      return;
    }

    if (contentArea.querySelector('.content-upload-trigger')) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'content-upload-trigger';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'content-upload-trigger__btn';
    button.textContent = 'Importer une image';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    button.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      if (input.files && input.files[0]) {
        handleImageFileDrop(input.files[0], {
          sectionElement: contentArea.querySelector('.section')
        });
        input.value = '';
      }
    });

    wrapper.appendChild(button);
    wrapper.appendChild(input);
    contentArea.appendChild(wrapper);
  }

  function getImageDimensionsFromFile(file) {
    return new Promise((resolve, reject) => {
      const imageUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const dimensions = {
          width: image.naturalWidth,
          height: image.naturalHeight
        };
        URL.revokeObjectURL(imageUrl);
        resolve(dimensions);
      };
      image.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        reject(new Error('Impossible de lire l’image.'));
      };
      image.src = imageUrl;
    });
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
   * Ajuste les dimensions des wrappers pour les images avec rotation initiale
   */
  function adjustImageWrappersForRotation() {
    const contentArea = document.querySelector('[data-content-area]');
    if (!contentArea) return;

    const images = contentArea.querySelectorAll('img[data-image-id]');
    
    images.forEach(imgElement => {
      const imageId = imgElement.getAttribute('data-image-id');
      if (!imageId) return;

      // Trouver l'imageData dans sectionsTree
      const imageData = findImageById(imageId);
      if (!imageData) return;

      // Fonction pour ajuster le wrapper
      const adjustWrapper = () => {
        // Lire la rotation initiale
        let rotation = 0;
        if (imageData.rotation !== undefined && imageData.rotation !== null) {
          if (typeof imageData.rotation === 'string') {
            const rotationValue = imageData.rotation.replace('deg', '').trim();
            rotation = parseFloat(rotationValue) || 0;
          } else {
            rotation = parseFloat(imageData.rotation) || 0;
          }
        }

        // Normaliser la rotation (0-360)
        const normalizedRotation = ((rotation % 360) + 360) % 360;
        
        // Si l'image est à 90° ou 270°, inverser les dimensions du wrapper
        if (normalizedRotation === 90 || normalizedRotation === 270) {
          const wrapper = imgElement.closest('.image-wrapper');
          if (!wrapper) return;

          // Lire les dimensions de l'image (priorité : style inline > imageData > naturalWidth/Height)
          let imgWidth = parseFloat(imgElement.style.width);
          let imgHeight = parseFloat(imgElement.style.height);
          
          // Si pas de dimensions dans le style, essayer depuis imageData
          if (!imgWidth && imageData.width) {
            imgWidth = parseFloat(imageData.width) || 0;
            // Convertir en px si nécessaire (peut être en pt)
            if (imageData.width.toString().includes('pt')) {
              imgWidth = imgWidth * 1.33; // 1pt ≈ 1.33px
            }
          }
          if (!imgHeight && imageData.height) {
            imgHeight = parseFloat(imageData.height) || 0;
            // Convertir en px si nécessaire
            if (imageData.height.toString().includes('pt')) {
              imgHeight = imgHeight * 1.33;
            }
          }
          
          // Si toujours pas de dimensions, utiliser les dimensions naturelles
          if (!imgWidth || imgWidth === 0) {
            imgWidth = imgElement.naturalWidth || imgElement.offsetWidth || 0;
          }
          if (!imgHeight || imgHeight === 0) {
            imgHeight = imgElement.naturalHeight || imgElement.offsetHeight || 0;
          }

          if (imgWidth && imgHeight && imgWidth > 0 && imgHeight > 0) {
            // Inverser les dimensions pour le wrapper : largeur = hauteur image, hauteur = largeur image
            wrapper.style.setProperty('width', `${imgHeight}px`, 'important');
            wrapper.style.setProperty('height', `${imgWidth}px`, 'important');
            
            // Centrer l'image dans le wrapper (comme dans la fonction de rotation manuelle)
            const deltaWidth = (imgHeight - imgWidth) / 2;
            const deltaHeight = (imgWidth - imgHeight) / 2;
            imgElement.style.marginLeft = `${deltaWidth}px`;
            imgElement.style.marginTop = `${deltaHeight}px`;
          }
        } else {
          // Pour 0° et 180°, s'assurer que le wrapper a les mêmes dimensions que l'image
          const wrapper = imgElement.closest('.image-wrapper');
          if (wrapper) {
            let imgWidth = parseFloat(imgElement.style.width);
            let imgHeight = parseFloat(imgElement.style.height);
            
            if (!imgWidth && imageData.width) {
              imgWidth = parseFloat(imageData.width) || 0;
              if (imageData.width.toString().includes('pt')) {
                imgWidth = imgWidth * 1.33;
              }
            }
            if (!imgHeight && imageData.height) {
              imgHeight = parseFloat(imageData.height) || 0;
              if (imageData.height.toString().includes('pt')) {
                imgHeight = imgHeight * 1.33;
              }
            }
            
            if (!imgWidth) imgWidth = imgElement.naturalWidth || imgElement.offsetWidth || 0;
            if (!imgHeight) imgHeight = imgElement.naturalHeight || imgElement.offsetHeight || 0;
            
            if (imgWidth && imgHeight && imgWidth > 0 && imgHeight > 0) {
              wrapper.style.setProperty('width', `${imgWidth}px`, 'important');
              wrapper.style.setProperty('height', `${imgHeight}px`, 'important');
              imgElement.style.marginLeft = '0';
              imgElement.style.marginTop = '0';
            }
          }
        }
      };

      // Si l'image est déjà chargée, ajuster immédiatement
      if (imgElement.complete && imgElement.naturalWidth > 0) {
        adjustWrapper();
      } else {
        // Sinon, attendre le chargement
        imgElement.addEventListener('load', adjustWrapper, { once: true });
      }
    });
  }

  /**
   * Rend les cards (vue card, colonne 1)
   */
  function renderCards(parentSection = null) {
    // Si on est au niveau racine, afficher aussi les options
    if (!parentSection) {
      renderCardsWithOptions();
      return;
    }

    const cardsGrid = document.querySelector('[data-cards-grid]');
    const breadcrumb = document.querySelector('[data-cards-breadcrumb]');
    const backButton = document.querySelector('[data-cards-back]');
    
    if (!cardsGrid) return;

    // Sections à afficher
    const sectionsToDisplay = parentSection.children || [];

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
      breadcrumb.textContent = parentSection.title || 'Sous-sections';
    }

    // Bouton retour
    if (backButton) {
      backButton.style.display = 'inline-block';
    }

    // Attacher les événements
    attachCardEvents();
  }

  /**
   * Rend les cards avec les options (niveau racine)
   */
  function renderCardsWithOptions() {
    const cardsGrid = document.querySelector('[data-cards-grid]');
    const breadcrumb = document.querySelector('[data-cards-breadcrumb]');
    const backButton = document.querySelector('[data-cards-back]');
    
    if (!cardsGrid) {
      console.warn('⚠️ cardsGrid non trouvé');
      return;
    }

    // Sections structurelles à afficher (filtrer les optionnelles)
    const sectionsToDisplay = sectionsTree || [];
    
    const filteredSections = sectionsToDisplay.filter(section => {
      if (!section || typeof section !== 'object') {
        return false;
      }
      
      const titleLower = (section.title || '').toLowerCase().trim();
      
      // Exclure les annexes et le sommaire
      if (titleLower === 'annexes' || titleLower === 'annexe' || titleLower === 'sommaire') {
        return false;
      }
      
      // Déterminer si la section est structurelle OU optionnelle active
      // Par défaut, si structure n'est pas défini ou est invalide, on considère que c'est structurel
      const structure = section.structure;
      const isStructural = structure === 'structural' || structure === undefined || structure === null || structure === '';
      const isOptionalActive = structure === 'optional' && section.actif === true;
      
      if (!isStructural && !isOptionalActive) {
        return false;
      }
      
      return true;
    });

    // Collecter toutes les options
    const optionalSections = [];
    const collectOptionalSections = (sections) => {
      sections.forEach(section => {
        const structure = section.structure || 'structural';
        if (structure === 'optional') {
          optionalSections.push(section);
        }
        if (Array.isArray(section.children)) {
          collectOptionalSections(section.children);
        }
      });
    };
    collectOptionalSections(sectionsTree);
    console.log(`   📋 Total options collectées: ${optionalSections.length}`);
    console.log(`   📋 Sections structurelles filtrées: ${filteredSections.length}`);

    // Générer le HTML pour les sections structurelles
    let sectionsHtml = '';
    
    if (filteredSections.length > 0) {
      filteredSections.forEach(section => {
        sectionsHtml += generateCardHTML(section);
      });
    } else {
      sectionsHtml = `
        <div class="text-muted" style="padding: 20px; text-align: center;">
          <p>Aucune section structurelle</p>
        </div>
      `;
    }
    
    cardsGrid.innerHTML = sectionsHtml;

    // Panel Options séparé : cards des options (actives et inactives)
    const optionsGrid = document.querySelector('[data-options-grid]');
    if (optionsGrid) {
      console.log('🔍 Panel Options - Recherche de data-options-grid:', optionsGrid ? 'trouvé' : 'NON TROUVÉ');
      console.log('🔍 Panel Options - Options collectées:', optionalSections.length);
      optionalSections.forEach((opt, idx) => {
        console.log(`   Option ${idx + 1}: "${opt.title}", actif=${opt.actif}, structure=${opt.structure}`);
      });
      
      // Afficher uniquement les options inactives dans le panel Options
      const inactiveOptions = optionalSections.filter(s => s.actif !== true);
      let optionsHtml = '';
      
      if (inactiveOptions.length > 0) {
        inactiveOptions.forEach(section => {
          optionsHtml += generateOptionCardHTML(section);
        });
        console.log('✅ Panel Options - HTML généré pour', inactiveOptions.length, 'options inactives');
      } else {
        optionsHtml = `
          <div class="text-muted" style="padding: 20px; text-align: center;">
            <p>Aucune option inactive</p>
            <p style="font-size: 12px; margin-top: 8px;">Les options actives sont intégrées dans les sections structurelles.</p>
          </div>
        `;
        console.log('⚠️ Panel Options - Aucune option inactive à afficher');
      }
      
      optionsGrid.innerHTML = optionsHtml;
      console.log('✅ Panel Options - HTML injecté, longueur:', optionsHtml.length);
    } else {
      console.error('❌ Panel Options - data-options-grid non trouvé dans le DOM');
    }

    // Formulaire de paramétrage des options dans l'onglet Options du panel de droite
    const optionsListCards = document.getElementById('optionsListCards');
    if (optionsListCards) {
      // Le formulaire sera affiché quand une option est sélectionnée
      optionsListCards.innerHTML = '<p class="text-muted">Sélectionnez une option pour voir et modifier ses paramètres.</p>';
    }

    // Breadcrumb
    if (breadcrumb) {
      breadcrumb.textContent = 'Niveau 1';
    }

    // Bouton retour
    if (backButton) {
      backButton.style.display = 'none';
    }

    // Attacher les événements (pour toutes les cards : structurelles + options)
    attachCardEvents();
    
    // Attacher les événements de drag and drop
    attachCardDragEvents();
    
    // Initialiser le bouton de récupération
    initRecoverOptionalSectionsButton();
    
    // Charger les templates disponibles dans le panel "Disponible"
    loadAvailableTemplates();
  }

  /**
   * Charge et affiche les templates de sections disponibles dans le panel "Disponible"
   */
  async function loadAvailableTemplates() {
    const availableTemplatesList = document.getElementById('availableTemplatesList');
    
    if (!availableTemplatesList) {
      console.warn('⚠️ Panel Disponible non trouvé');
      return;
    }

    // Vérifier que le template document est défini
    if (!documentTemplateName) {
      availableTemplatesList.innerHTML = '<p class="text-muted">Template document non défini</p>';
      return;
    }

    try {
      // Récupérer tous les templates avec le scope du document actuel
      const response = await fetch(`${apiBase}/agent-documentaire/templates?scope=${encodeURIComponent(documentTemplateName)}`);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const payload = await response.json();
      
      if (!payload.success) {
        throw new Error(payload.error || 'Erreur lors du chargement des templates');
      }

      const allTemplates = payload.data || [];
      
      // Filtrer : garder seulement les templates de sections (avec ':' dans le namespace)
      // et exclure le template document lui-même (sans ':')
      const sectionTemplates = allTemplates.filter(template => {
        // Exclure le template document (celui sans ':' dans le namespace)
        if (!template.namespace.includes(':')) {
          return false;
        }
        
        // Garder seulement les templates de sections qui commencent par le scope du document
        return template.namespace.startsWith(`${documentTemplateName}:`);
      });

      if (sectionTemplates.length === 0) {
        availableTemplatesList.innerHTML = `
          <div class="text-muted" style="padding: 20px; text-align: center;">
            <p>Aucun template de section disponible</p>
            <p style="font-size: 12px; margin-top: 8px;">Les templates de sections seront disponibles ici après sauvegarde.</p>
          </div>
        `;
        return;
      }

      // Générer le HTML pour chaque template
      const templatesHtml = sectionTemplates.map(template => {
        const sectionName = template.namespace.split(':').pop(); // Nom de la section après le ':'
        return `
          <div class="template-item" data-template-namespace="${template.namespace}">
            <div class="template-item__content">
              <div class="template-item__name">${template.name || sectionName}</div>
              <div class="template-item__meta">
                ${template.metadata?.createdAt ? `Créé le ${new Date(template.metadata.createdAt).toLocaleDateString('fr-FR')}` : ''}
              </div>
            </div>
            <button class="btn btn-sm btn-primary template-item__add-btn" data-add-template="${template.namespace}">
              ➕ Ajouter
            </button>
          </div>
        `;
      }).join('');

      availableTemplatesList.innerHTML = templatesHtml;

      // Attacher les événements de clic pour ajouter un template
      availableTemplatesList.querySelectorAll('[data-add-template]').forEach(btn => {
        btn.addEventListener('click', async function(e) {
          e.stopPropagation();
          const templateNamespace = this.dataset.addTemplate;
          await addTemplateToDocument(templateNamespace);
        });
      });

    } catch (error) {
      console.error('❌ Erreur chargement templates disponibles:', error);
      availableTemplatesList.innerHTML = `
        <div class="text-muted" style="padding: 20px; text-align: center; color: #d32f2f;">
          <p>Erreur lors du chargement</p>
          <p style="font-size: 12px; margin-top: 8px;">${error.message}</p>
        </div>
      `;
    }
  }

  /**
   * Ajoute une section depuis un template au document
   * @param {string} templateNamespace - Namespace du template de section
   */
  async function addTemplateToDocument(templateNamespace) {
    if (!templateNamespace) {
      alert('Namespace du template manquant');
      return;
    }

    try {
      // Récupérer le template
      const templateResponse = await fetch(`${apiBase}/agent-documentaire/templates/${encodeURIComponent(templateNamespace)}`);
      
      if (!templateResponse.ok) {
        throw new Error(`Template non trouvé: ${templateResponse.status}`);
      }

      const templatePayload = await templateResponse.json();
      
      if (!templatePayload.success || !templatePayload.data) {
        throw new Error(templatePayload.error || 'Template non trouvé');
      }

      const template = templatePayload.data;

      // Créer une nouvelle section à partir du template
      // Pour l'instant, on crée juste une section basique avec le contenu du template
      // TODO: Gérer l'héritage du canvas, les variables, etc.
      
      const newSection = {
        id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: template.title || template.name || 'Nouvelle section',
        level: template.level || 1,
        structure: template.isOptional ? 'optional' : 'structural',
        actif: template.isOptional ? false : true,
        content: template.content ? JSON.parse(JSON.stringify(template.content)) : [],
        children: [],
        numbering: '',
        isAnnex: false
      };

      // Ajouter la section au document
      if (!Array.isArray(sectionsTree)) {
        sectionsTree = [];
      }

      sectionsTree.push(newSection);

      // Recharger l'affichage
      renderCardsWithOptions();
      renderAll();

      // Sauvegarder le document
      await saveDocument();

      // Recharger la liste des templates disponibles
      await loadAvailableTemplates();

      alert(`✅ Section "${newSection.title}" ajoutée avec succès !`);

    } catch (error) {
      console.error('❌ Erreur ajout template:', error);
      alert(`Erreur lors de l'ajout de la section : ${error.message}`);
    }
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
    const structure = section.structure || 'structural';
    const isOptional = structure === 'optional';

    return `
      <div class="section-card" data-card-id="${sectionId}" draggable="true">
        ${isOptional ? `<span class="section-card__badge section-card__badge--optional">🔘 Optionnel</span>` : ''}
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
   * Génère le HTML d'une card d'option
   */
  function generateOptionCardHTML(section) {
    const sectionId = section.id || '';
    const title = section.title || '(Sans titre)';
    const actif = section.actif !== undefined ? section.actif : false;
    const isDocument = section.isDocument || false;
    const documentId = section.documentId || null;
    // Normaliser les catégories : convertir string en tableau si nécessaire
    let categories = section.category || [];
    if (typeof categories === 'string') {
      categories = categories ? [categories] : [];
    }
    if (!Array.isArray(categories)) {
      categories = [];
    }
    if (categories.length === 0) {
      categories = ['Sans catégorie'];
    }

    return `
      <div class="section-card option-card ${actif ? 'is-active' : 'is-inactive'}" data-card-id="${sectionId}" data-card-type="option" draggable="true">
        <div class="section-card__header">
          <div class="section-card__title">${title}</div>
          <div class="section-card__badge ${actif ? 'badge-active' : 'badge-inactive'}">
            ${actif ? '✅ Actif' : '❌ Inactif'}
          </div>
        </div>
        <div class="section-card__meta">
          ${categories.map(cat => `<span class="section-card__badge">📁 ${cat}</span>`).join('')}
          ${isDocument && documentId ? `<span class="section-card__badge">📄 Document</span>` : ''}
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
      let clickTimeout = null;
      
      // Simple clic : sélectionner et afficher les propriétés
      card.addEventListener('click', (e) => {
        // Annuler le timeout si double clic
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
          return;
        }
        
        // Attendre un peu pour détecter le double clic
        clickTimeout = setTimeout(() => {
          clickTimeout = null;
          
          const cardId = card.dataset.cardId;
          const cardType = card.dataset.cardType; // 'option' ou undefined
          console.log('🖱️ Card cliquée, cardId:', cardId, 'cardType:', cardType);
          
          // Chercher la section dans toutes les sections (structurelles + options)
          let section = findSectionById(cardId, sectionsTree);
          
          // Si pas trouvé dans les structurelles, chercher dans les options collectées
          if (!section && cardType === 'option') {
            // Les options sont dans optionalSections (collectées au début de renderCardsWithOptions)
            const allOptionalSections = [];
            const collectOptionalSections = (sections) => {
              sections.forEach(s => {
                const structure = s.structure || 'structural';
                if (structure === 'optional') {
                  allOptionalSections.push(s);
                }
                if (Array.isArray(s.children)) {
                  collectOptionalSections(s.children);
                }
              });
            };
            collectOptionalSections(sectionsTree);
            section = allOptionalSections.find(s => s.id === cardId);
          }
          
          console.log('   Section trouvée:', section ? section.title : 'NON TROUVÉE');
          
          if (section) {
            // Retirer la sélection précédente
            document.querySelectorAll('.section-card').forEach(c => c.classList.remove('is-selected'));
            // Sélectionner cette card
            card.classList.add('is-selected');
            
            // Toutes les cards (structurelles et optionnelles) affichent le formulaire dans l'onglet Options
            console.log('🔵 Card cliquée:', section?.title, 'Type:', cardType || 'structurelle');
            
            // Basculer vers l'onglet Options
            const optionsTab = document.querySelector('[data-properties-tabs="card-properties"] [data-properties-tab="options"]');
            console.log('📑 Onglet Options trouvé:', optionsTab ? 'oui' : 'non');
            
            if (optionsTab) {
              optionsTab.click();
              // Attendre un peu que l'onglet s'active puis afficher le formulaire
              setTimeout(() => {
                console.log('⏱️ Timeout terminé, affichage du formulaire...');
                displayOptionsForm(section);
              }, 200);
            } else {
              console.warn('⚠️ Onglet Options non trouvé, affichage direct');
              displayOptionsForm(section);
            }
          } else {
            console.error('❌ Section non trouvée pour cardId:', cardId);
            console.error('   sectionsTree:', sectionsTree);
            console.error('   optionalSections:', optionalSections);
          }
        }, 250); // Délai pour détecter le double clic
      });
      
      // Double clic : naviguer vers les enfants (seulement pour les sections structurelles)
      card.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Annuler le simple clic
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
        }
        
        const cardId = card.dataset.cardId;
        const cardType = card.dataset.cardType;
        const section = findSectionById(cardId, sectionsTree);
        
        // Seulement pour les sections structurelles avec enfants
        if (section && !cardType && section.children && section.children.length > 0) {
          currentCardParent = section;
          renderCards(section);
        }
      });
    });
  }

  /**
   * Variables pour le drag and drop des cards
   */
  let draggedCard = null;
  let draggedCardSection = null;

  /**
   * Attache les événements de drag and drop pour les cards
   */
  function attachCardDragEvents() {
    const cards = document.querySelectorAll('.section-card[draggable="true"]');
    
    cards.forEach(card => {
      // Drag start
      card.addEventListener('dragstart', (e) => {
        draggedCard = card;
        const cardId = card.dataset.cardId;
        draggedCardSection = findSectionById(cardId, sectionsTree);
        
        if (!draggedCardSection) {
          // Chercher aussi dans les options
          const allOptionalSections = [];
          const collectOptionalSections = (sections) => {
            sections.forEach(s => {
              const structure = s.structure || 'structural';
              if (structure === 'optional') {
                allOptionalSections.push(s);
              }
              if (Array.isArray(s.children)) {
                collectOptionalSections(s.children);
              }
            });
          };
          collectOptionalSections(sectionsTree);
          draggedCardSection = allOptionalSections.find(s => s.id === cardId);
        }
        
        if (draggedCardSection) {
          card.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', cardId);
        } else {
          e.preventDefault();
        }
      });

      // Drag over
      card.addEventListener('dragover', (e) => {
        if (!draggedCard || card === draggedCard) return;
        
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const rect = card.getBoundingClientRect();
        const verticalMidpoint = rect.top + rect.height / 2;
        const horizontalMidpoint = rect.left + rect.width / 2;
        
        // Zone centrale (30% du centre) = sous-section
        const centerZoneTop = rect.top + rect.height * 0.35;
        const centerZoneBottom = rect.top + rect.height * 0.65;
        const centerZoneLeft = rect.left + rect.width * 0.35;
        const centerZoneRight = rect.left + rect.width * 0.65;
        
        const isInCenterZone = e.clientY >= centerZoneTop && e.clientY <= centerZoneBottom &&
                               e.clientX >= centerZoneLeft && e.clientX <= centerZoneRight;
        
        // Si dans la zone centrale → sous-section
        if (isInCenterZone) {
          card.classList.remove('drop-above', 'drop-below', 'drop-left', 'drop-right');
          card.classList.add('drop-inside');
        } else {
          // Sinon, déterminer la position relative
          const isAbove = e.clientY < verticalMidpoint;
          const isLeft = e.clientX < horizontalMidpoint;
          
          card.classList.remove('drop-above', 'drop-below', 'drop-left', 'drop-right', 'drop-inside');
          
          if (isAbove) {
            card.classList.add('drop-above');
          } else {
            card.classList.add('drop-below');
          }
          
          if (isLeft) {
            card.classList.add('drop-left');
          } else {
            card.classList.add('drop-right');
          }
        }
      });

      // Drag leave
      card.addEventListener('dragleave', (e) => {
        card.classList.remove('drop-above', 'drop-below', 'drop-left', 'drop-right', 'drop-inside');
      });

      // Drop
      card.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!draggedCard || !draggedCardSection || card === draggedCard) {
          cleanupCardDragClasses();
          return;
        }

        const targetCardId = card.dataset.cardId;
        const targetSection = findSectionById(targetCardId, sectionsTree);
        
        if (!targetSection) {
          cleanupCardDragClasses();
          return;
        }

        // Déterminer la position du drop
        const rect = card.getBoundingClientRect();
        const horizontalMidpoint = rect.left + rect.width / 2;
        const verticalMidpoint = rect.top + rect.height / 2;
        
        // Zone centrale (40% du centre verticalement et horizontalement) = sous-section
        const centerZoneTop = rect.top + rect.height * 0.3;
        const centerZoneBottom = rect.top + rect.height * 0.7;
        const centerZoneLeft = rect.left + rect.width * 0.3;
        const centerZoneRight = rect.left + rect.width * 0.7;
        
        // Vérifier si on est dans la zone centrale
        const isInCenterZone = e.clientY >= centerZoneTop && e.clientY <= centerZoneBottom &&
                               e.clientX >= centerZoneLeft && e.clientX <= centerZoneRight;
        
        let dropPosition;
        if (isInCenterZone) {
          // Drop au centre → sous-section
          dropPosition = 'inside';
          console.log('📍 Drop: inside (sous-section)');
        } else {
          // Drop à gauche ou à droite → avant ou après (priorité à la position horizontale)
          const isLeft = e.clientX < horizontalMidpoint;
          dropPosition = isLeft ? 'before' : 'after';
          console.log(`📍 Drop: ${dropPosition} (${isLeft ? 'gauche' : 'droite'}) - X: ${e.clientX}, midpoint: ${horizontalMidpoint}`);
        }

        // Vérifier si on glisse une section optionnelle inactive vers une section structurelle
        const draggedIsOptional = (draggedCardSection.structure || 'structural') === 'optional';
        const draggedIsInactive = draggedIsOptional && draggedCardSection.actif === false;
        const targetIsStructural = (targetSection.structure || 'structural') === 'structural';

        // Si on glisse une option inactive vers une section structurelle, l'activer et la transformer en structurelle
        if (draggedIsInactive && targetIsStructural) {
          // Mettre à jour localement (sans sauvegarder)
          draggedCardSection.structure = 'structural';
          draggedCardSection.actif = true;
          draggedCardSection.parent = null;
          draggedCardSection.category = null;
          console.log('✅ Section optionnelle transformée en structurelle (local):', draggedCardSection.title);
        }

        // Réorganiser dans sectionsTree
        reorganizeSections(draggedCardSection, targetSection, dropPosition);

        // Recalculer la numérotation localement
        recalculateNumbering();

        // Mettre à jour l'affichage localement (sans sauvegarder)
        const cardsView = document.querySelector('.view-card.is-active');
        if (cardsView) {
          if (currentCardParent) {
            renderCards(currentCardParent);
          } else {
            renderCardsWithOptions();
          }
        }
        
        // Mettre à jour aussi la vue texte
        renderSommaire();
        renderContent();
        
        console.log('✅ Réorganisation effectuée (modifications en mémoire, non sauvegardées)');

        cleanupCardDragClasses();
      });

      // Drag end
      card.addEventListener('dragend', (e) => {
        cleanupCardDragClasses();
        draggedCard = null;
        draggedCardSection = null;
      });
    });
  }

  /**
   * Nettoie les classes CSS du drag and drop des cards
   */
  function cleanupCardDragClasses() {
    // Nettoyer toutes les classes de drop de toutes les cards
    document.querySelectorAll('.section-card').forEach(card => {
      card.classList.remove('drop-above', 'drop-below', 'drop-left', 'drop-right', 'drop-inside', 'dragging');
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

  function findImageById(imageId, sections = sectionsTree) {
    if (!imageId || !Array.isArray(sections)) return null;
    for (const section of sections) {
      if (section.content && Array.isArray(section.content)) {
        for (const item of section.content) {
          if (item.type === 'image' && item.id === imageId) {
            return item;
          }
        }
      }
      if (section.children && section.children.length > 0) {
        const found = findImageById(imageId, section.children);
        if (found) return found;
      }
    }
    return null;
  }

  function findImageByName(imageName, sections = sectionsTree) {
    if (!imageName || !Array.isArray(sections)) return null;
    for (const section of sections) {
      if (section.content && Array.isArray(section.content)) {
        for (const item of section.content) {
          if (item.type === 'image') {
            const candidate = (item.src || item.name || '').includes('/')
              ? (item.src || item.name || '').split('/').pop()
              : (item.src || item.name || '');
            if (candidate === imageName) {
              return item;
            }
          }
        }
      }
      if (section.children && section.children.length > 0) {
        const found = findImageByName(imageName, section.children);
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
   * Affiche le formulaire de paramétrage des options
   */
  function displayOptionsForm(section) {
    if (!section) {
      console.warn('❌ Section non fournie à displayOptionsForm');
      return;
    }
    
    console.log('🎯 displayOptionsForm appelé pour:', section?.title);
    console.log('   Section complète:', section);
    
    const optionsList = document.getElementById('optionsListCards');
    if (!optionsList) {
      console.error('❌ optionsListCards non trouvé dans le DOM');
      return;
    }
    
    console.log('✅ optionsListCards trouvé');
    
    // Utiliser la fonction existante pour générer le formulaire
    const html = displaySectionOptionsProperties(section);
    console.log('📝 HTML généré, longueur:', html?.length || 0);
    
    if (!html || html.length === 0) {
      console.error('❌ HTML vide ou invalide');
      optionsList.innerHTML = '<p class="text-danger">Erreur : Impossible de générer le formulaire</p>';
      return;
    }
    
    optionsList.innerHTML = html;
    console.log('✅ HTML injecté dans optionsListCards');
    
    // Attacher les événements après un petit délai pour s'assurer que le DOM est prêt
    setTimeout(() => {
      attachSectionOptionsEvents();
      console.log('✅ Événements attachés');
      
      // Vérifier que le bouton existe
      const validateBtn = document.getElementById('section-validate-btn-options');
      console.log('🔍 Vérification bouton Valider après injection:', validateBtn ? 'TROUVÉ' : 'NON TROUVÉ');
    }, 50);
  }

  /**
   * Gère le bouton retour dans la vue card
   */
  function initCardBackButton() {
    const backButton = document.querySelector('[data-cards-back]');
    if (!backButton) return;

    backButton.addEventListener('click', () => {
      currentCardParent = null;
      renderCards(); // renderCards() appelle renderCardsWithOptions() si parentSection est null
    });
  }

  /**
   * Initialise le bouton de récupération des sections optionnelles perdues
   */
  function initRecoverOptionalSectionsButton() {
    const recoverBtn = document.getElementById('recoverOptionalSectionsBtn');
    if (!recoverBtn) return;

    recoverBtn.addEventListener('click', async () => {
      if (!documentId || !apiBase) {
        alert('Erreur : Document non chargé');
        return;
      }

      if (!confirm('Voulez-vous récupérer les sections optionnelles perdues ?')) {
        return;
      }

      recoverBtn.disabled = true;
      recoverBtn.textContent = '🔄 Récupération...';

      try {
        const response = await fetch(`${apiBase}/agent-documentaire/document/${documentId}/sections/recover-optional`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const payload = await response.json();
        
        if (payload.success) {
          const recoveredCount = payload.recoveredCount || 0;
          if (recoveredCount > 0) {
            alert(`✅ ${recoveredCount} section(s) optionnelle(s) récupérée(s) !`);
            await loadDocument();
            // Recharger les cards si on est dans la vue cards
            const cardsView = document.getElementById('cardsView');
            if (cardsView && cardsView.classList.contains('is-active')) {
              renderCardsWithOptions();
            }
          } else {
            alert('ℹ️ Aucune section optionnelle perdue à récupérer.');
          }
        } else {
          alert('Erreur : ' + (payload.error || 'Impossible de récupérer les sections'));
        }
      } catch (error) {
        console.error('Erreur récupération sections:', error);
        alert('Erreur lors de la récupération : ' + error.message);
      } finally {
        recoverBtn.disabled = false;
        recoverBtn.textContent = '🔄 Récupérer';
      }
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

        // Si on clique sur l'onglet Options, charger les options
        if (targetTab === 'options') {
          loadOptionsList();
        }
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

    // Boutons de l'onglet Options
    const createOptionSectionBtn = document.getElementById('createOptionSectionBtn');
    const createOptionDocumentBtn = document.getElementById('createOptionDocumentBtn');
    const reintegrateDocumentBtn = document.getElementById('reintegrateDocumentBtn');

    if (createOptionSectionBtn) {
      createOptionSectionBtn.addEventListener('click', () => {
        // Ouvrir un modal pour sélectionner une section à convertir en option
        openSelectSectionModal();
      });
    }

    if (createOptionDocumentBtn) {
      createOptionDocumentBtn.addEventListener('click', () => {
        openCreateOptionDocumentModal();
      });
    }

    if (reintegrateDocumentBtn) {
      reintegrateDocumentBtn.addEventListener('click', () => {
        // Ouvrir un modal pour sélectionner un document à réintégrer
        openReintegrateDocumentModal();
      });
    }
  }

  /**
   * Charge et affiche la liste des options dans la vue cards
   */
  async function loadOptionsListCards() {
    const optionsList = document.getElementById('optionsListCards');
    if (!optionsList) return;

    // Utiliser la même logique que loadOptionsList mais pour les cards
    await loadOptionsListInternal(optionsList, 'cards');
  }

  /**
   * Charge et affiche la liste des options dans le sidebar
   */
  async function loadOptionsListSidebar() {
    console.log('🚀 loadOptionsListSidebar appelé');
    const optionsList = document.getElementById('optionsListSidebar');
    if (!optionsList) {
      console.warn('❌ optionsListSidebar non trouvé dans le DOM');
      return;
    }
    console.log('✅ optionsListSidebar trouvé');

    // Vérifier si le document est chargé
    console.log('📊 État du document:');
    console.log('   - documentJson:', documentJson ? 'existe' : 'null');
    console.log('   - sectionsTree:', sectionsTree?.length || 0, 'sections');
    
    if (!documentJson || !sectionsTree || sectionsTree.length === 0) {
      console.log('⏳ Document non encore chargé, attente...');
      // Attendre que le document soit chargé
      let attempts = 0;
      while ((!documentJson || !sectionsTree || sectionsTree.length === 0) && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
      
      if (!documentJson || !sectionsTree || sectionsTree.length === 0) {
        console.warn('⚠️ Document toujours non chargé après attente');
        optionsList.innerHTML = '<p class="text-muted">Chargement du document en cours... Veuillez patienter.</p>';
        return;
      }
    }

    // Utiliser la même logique que loadOptionsList mais pour le sidebar
    console.log('📥 Appel de loadOptionsListInternal...');
    await loadOptionsListInternal(optionsList, 'sidebar');
  }

  /**
   * Charge et affiche la liste des options
   */
  async function loadOptionsList() {
    const optionsList = document.getElementById('optionsList');
    if (!optionsList) return;

    await loadOptionsListInternal(optionsList, 'modal');
  }

  /**
   * Affiche les propriétés d'option d'une section dans l'onglet Options
   */
  function displaySectionOptionsProperties(section) {
    if (!section) return '';

    const structure = section.structure || 'structural';
    const actif = section.actif !== undefined ? section.actif : (structure === 'structural' ? true : false);
    
    // Déterminer le parent : utiliser section.parent si défini, sinon trouver le parent dans l'arbre structurel
    let parent = section.parent || null;
    if (!parent && structure === 'optional') {
      // Si pas de parent défini, chercher le parent dans l'arbre structurel
      const structuralParent = findParentSection(section.id, sectionsTree);
      if (structuralParent) {
        parent = structuralParent.id;
      }
    }
    
    // Par défaut, la case à cocher est cochée si un parent est défini
    const hasParentEnabled = parent !== null;
    // Normaliser les catégories : convertir string en tableau si nécessaire
    let categories = section.category || [];
    if (typeof categories === 'string') {
      categories = categories ? [categories] : [];
    }
    if (!Array.isArray(categories)) {
      categories = [];
    }
    // Si aucune catégorie et que c'est optionnel, pré-remplir avec "dossier technique"
    if (structure === 'optional' && categories.length === 0) {
      categories = ['dossier technique'];
    }
    const isDocument = section.isDocument || false;
    const documentId = section.documentId || null;
    
    // Liste des catégories disponibles
    const availableCategories = ['dossier technique'];

    // Récupérer toutes les sections pour le dropdown parent
    const allSections = [];
    const collectSections = (sections, level = 0) => {
      sections.forEach(s => {
        if (s.id !== section.id) {
          allSections.push({ id: s.id, title: s.title || '(Sans titre)', level });
          if (Array.isArray(s.children)) {
            collectSections(s.children, level + 1);
          }
        }
      });
    };
    collectSections(sectionsTree);

    let html = `
      <div class="options-section">
        <h5>⚙️ Configuration de la section : ${section.title || '(Sans titre)'}</h5>
        <div class="section-options-form" id="section-options-form-${section.id}">
          <div class="form-group">
            <label>Type <span class="text-danger">*</span></label>
            <select class="form-control" id="section-structure-select-options" data-section-id="${section.id}">
              <option value="structural" ${structure === 'structural' ? 'selected' : ''}>Structurel</option>
              <option value="optional" ${structure === 'optional' ? 'selected' : ''}>Optionnel</option>
            </select>
            <small class="text-muted">Les sections structurelles sont toujours affichées. Les sections optionnelles peuvent être activées/désactivées.</small>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="section-actif-checkbox-options" data-section-id="${section.id}" 
                     ${actif ? 'checked' : ''}>
              Actif
            </label>
            <small class="text-muted">Cocher pour activer cette option dans le document</small>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="section-has-parent-checkbox-options" data-section-id="${section.id}" 
                     ${hasParentEnabled ? 'checked' : ''}>
              Utiliser une section parente
            </label>
          </div>
          <div class="form-group" id="section-parent-wrapper-options" style="${hasParentEnabled && structure === 'optional' ? '' : 'display: none;'}">
            <label>Section parente</label>
            <select class="form-control" id="section-parent-select-options" data-section-id="${section.id}">
              <option value="">Aucune (racine)</option>
              ${allSections.map(s => 
                `<option value="${s.id}" ${parent === s.id ? 'selected' : ''}>
                  ${'&nbsp;&nbsp;'.repeat(s.level)}${s.title}
                </option>`
              ).join('')}
            </select>
            <small class="text-muted">Section parente où cette option sera logiquement placée</small>
          </div>
          <div class="form-group">
            <label>Catégories <span class="text-danger">*</span></label>
            <select class="form-control" id="section-category-select-options" 
                    data-section-id="${section.id}" 
                    required
                    multiple
                    size="${Math.min(availableCategories.length + 1, 5)}"
                    style="min-height: 80px;">
              ${availableCategories.map(cat => 
                `<option value="${cat}" ${categories.includes(cat) ? 'selected' : ''}>${cat}</option>`
              ).join('')}
            </select>
            <small class="text-muted">Sélectionnez une ou plusieurs catégories (maintenez Ctrl/Cmd pour sélection multiple)</small>
          </div>
          <div class="form-group" style="margin-top: 20px;">
            <button type="button" class="btn btn-primary" id="section-validate-btn-options" data-section-id="${section.id}">
              ✅ Valider les modifications
            </button>
          </div>
    `;

    // Si c'est un document réintégré
    if (isDocument && documentId) {
      html += `
          <div class="form-group">
            <label>
              <input type="checkbox" id="section-is-document-checkbox-options" data-section-id="${section.id}" checked disabled>
              Document réintégré
            </label>
            <button class="btn btn-sm btn-outline" onclick="window.open('${window.location.origin}${window.location.pathname}?document=${documentId}', '_blank')">
              Ouvrir le document
            </button>
          </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Attache les événements pour les propriétés de section dans l'onglet Options
   */
  function attachSectionOptionsEvents() {
    // Fonction pour activer/désactiver les champs selon le type
    const updateFieldsState = (isOptional) => {
      const actifCheckbox = document.getElementById('section-actif-checkbox-options');
      const hasParentCheckbox = document.getElementById('section-has-parent-checkbox-options');
      const parentWrapper = document.getElementById('section-parent-wrapper-options');
      const parentSelect = document.getElementById('section-parent-select-options');
      const categorySelect = document.getElementById('section-category-select-options');
      
      // Activer/désactiver selon le type
      if (actifCheckbox) {
        actifCheckbox.disabled = !isOptional;
      }
      if (hasParentCheckbox) {
        hasParentCheckbox.disabled = !isOptional;
      }
      if (parentWrapper) {
        parentWrapper.style.display = (isOptional && hasParentCheckbox?.checked) ? 'block' : 'none';
      }
      if (parentSelect) {
        parentSelect.disabled = !isOptional;
      }
      if (categorySelect) {
        categorySelect.disabled = !isOptional;
        categorySelect.required = isOptional;
      }
    };
    
    // Initialiser l'état des champs
    const structureSelect = document.getElementById('section-structure-select-options');
    if (structureSelect) {
      const currentValue = structureSelect.value;
      updateFieldsState(currentValue === 'optional');
      
      // Changement de type Structurel/Optionnel (sans appliquer, juste mettre à jour l'UI)
      structureSelect.addEventListener('change', (e) => {
        const newStructure = e.target.value;
        updateFieldsState(newStructure === 'optional');
        
        // Si on passe à optionnel, réinitialiser le parent à null (racine)
        if (newStructure === 'optional') {
          const hasParentCheckbox = document.getElementById('section-has-parent-checkbox-options');
          const parentSelect = document.getElementById('section-parent-select-options');
          const parentWrapper = document.getElementById('section-parent-wrapper-options');
          
          if (hasParentCheckbox) {
            hasParentCheckbox.checked = false;
          }
          if (parentSelect) {
            parentSelect.value = '';
          }
          if (parentWrapper) {
            parentWrapper.style.display = 'none';
          }
        }
      });
    }
    
    // Bouton Valider - applique tous les changements d'un coup
    const validateBtn = document.getElementById('section-validate-btn-options');
    console.log('🔍 Bouton Valider trouvé:', validateBtn ? 'OUI' : 'NON');
    
    if (validateBtn) {
      // Supprimer les anciens listeners pour éviter les doublons
      const newValidateBtn = validateBtn.cloneNode(true);
      validateBtn.parentNode.replaceChild(newValidateBtn, validateBtn);
      
      newValidateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('🔘 Clic sur le bouton Valider');
        const sectionId = newValidateBtn.dataset.sectionId;
        console.log('   Section ID:', sectionId);
        
        try {
          const section = findSectionById(sectionId, sectionsTree);
          
          if (!section) {
            alert('Erreur: Section non trouvée');
            console.error('❌ Section non trouvée:', sectionId);
            return;
          }
          
          console.log('   Section trouvée:', section.title);
          console.log('   Structure actuelle:', section.structure);
          
          // Récupérer toutes les valeurs du formulaire
          const structureSelect = document.getElementById('section-structure-select-options');
          const actifCheckbox = document.getElementById('section-actif-checkbox-options');
          const hasParentCheckbox = document.getElementById('section-has-parent-checkbox-options');
          const parentSelect = document.getElementById('section-parent-select-options');
          const categorySelect = document.getElementById('section-category-select-options');
          
          if (!structureSelect) {
            alert('Erreur: Formulaire non trouvé');
            console.error('❌ structureSelect non trouvé');
            return;
          }
          
          const newStructure = structureSelect.value;
          const newActif = actifCheckbox ? actifCheckbox.checked : false;
          const hasParent = hasParentCheckbox ? hasParentCheckbox.checked : false;
          const newParentId = (hasParent && parentSelect) ? (parentSelect.value || null) : null;
          
          console.log('   Nouvelle structure:', newStructure);
          console.log('   Nouveau actif:', newActif);
          console.log('   Nouveau parent:', newParentId);
          
          // Récupérer les catégories
          let categories = [];
          if (categorySelect) {
            const selectedOptions = Array.from(categorySelect.selectedOptions);
            categories = selectedOptions.map(opt => opt.value);
          }
          console.log('   Nouvelles catégories:', categories);
          
          // Si aucune catégorie et que c'est optionnel, pré-remplir avec "dossier technique"
          if (newStructure === 'optional' && categories.length === 0) {
            categories = ['dossier technique'];
            console.log('   Catégorie par défaut ajoutée: dossier technique');
          }
          
          // PRIORITÉ 1 : Si la structure change
          if (newStructure !== (section.structure || 'structural')) {
            console.log('   🔄 Changement de structure:', section.structure, '→', newStructure);
            // Changer la structure
            const success = changeSectionStructureLocal(sectionId, newStructure, newParentId, categories.length > 0 ? categories : null);
            if (!success) {
              alert('Erreur lors du changement de structure');
              console.error('❌ Échec du changement de structure');
              return;
            }
            console.log('   ✅ Changement de structure réussi');
            
            // Si on passe en optionnel, mettre à jour actif, parent et category
            if (newStructure === 'optional') {
              const updatedSection = findSectionById(sectionId, sectionsTree);
              if (updatedSection) {
                updatedSection.actif = newActif;
                updatedSection.parent = newParentId;
                updatedSection.category = categories.length > 0 ? categories : null;
                console.log('   Propriétés optionnelles mises à jour:', { 
                  actif: updatedSection.actif, 
                  parent: updatedSection.parent, 
                  category: updatedSection.category 
                });
              }
            }
          }
          // PRIORITÉ 2 : Juste mettre à jour les propriétés (structure ne change pas)
          else {
            console.log('   🔄 Mise à jour des propriétés uniquement (structure ne change pas)');
            // Si c'est optionnel, mettre à jour actif, parent et category
            if (newStructure === 'optional') {
              const oldActif = section.actif;
              section.actif = newActif;
              section.parent = newParentId;
              section.category = categories.length > 0 ? categories : null;
              console.log('   Propriétés optionnelles mises à jour:', { 
                actif: `${oldActif} → ${section.actif}`, 
                parent: section.parent, 
                category: section.category 
              });
            }
          }
          
          // Recalculer la numérotation
          recalculateNumbering();
          console.log('   Numérotation recalculée');
          
          // Vérifier l'état final de la section
          const finalSection = findSectionById(sectionId, sectionsTree);
          if (finalSection) {
            console.log('   État final de la section:', {
              id: finalSection.id,
              title: finalSection.title,
              structure: finalSection.structure,
              actif: finalSection.actif,
              parent: finalSection.parent,
              category: finalSection.category
            });
          }
          
          // Mettre à jour l'affichage
          const cardsView = document.querySelector('.view-card.is-active');
          if (cardsView) {
            renderCardsWithOptions();
            console.log('   Cards réaffichées');
            // Ré-sélectionner la card
            setTimeout(() => {
              const updatedSection = findSectionById(sectionId, sectionsTree);
              if (updatedSection) {
                const card = document.querySelector(`[data-card-id="${sectionId}"]`);
                if (card) {
                  card.classList.add('is-selected');
                  displayOptionsForm(updatedSection);
                  console.log('   Formulaire mis à jour avec la nouvelle section');
                } else {
                  console.warn('   ⚠️ Card non trouvée après mise à jour');
                }
              } else {
                console.error('   ❌ Section non trouvée après mise à jour');
              }
            }, 100);
          } else {
            console.warn('   ⚠️ Vue card non active');
          }
          renderSommaire();
          renderContent();
          console.log('   Affichage mis à jour (sommaire et contenu)');
          
          // Feedback visuel
          newValidateBtn.textContent = '✅ Validé !';
          newValidateBtn.classList.add('btn-success');
          setTimeout(() => {
            newValidateBtn.textContent = '✅ Valider les modifications';
            newValidateBtn.classList.remove('btn-success');
          }, 1500);
          
          console.log('✅ Modifications validées (en mémoire, non sauvegardées)');
        } catch (error) {
          console.error('❌ Erreur lors de la validation:', error);
          alert('Erreur lors de la validation: ' + error.message);
        }
      });
    } else {
      console.error('❌ Bouton Valider non trouvé dans le DOM');
    }

    // Changement d'état actif (juste mettre à jour l'UI, pas d'application immédiate)
    const actifCheckbox = document.getElementById('section-actif-checkbox-options');
    // Pas d'événement - les changements seront appliqués au clic sur "Valider"

    // Case à cocher pour activer/désactiver la section parente
    const hasParentCheckbox = document.getElementById('section-has-parent-checkbox-options');
    if (hasParentCheckbox) {
      hasParentCheckbox.addEventListener('change', (e) => {
        const sectionId = e.target.dataset.sectionId;
        const isChecked = e.target.checked;
        const parentWrapper = document.getElementById('section-parent-wrapper-options');
        const parentSelect = document.getElementById('section-parent-select-options');
        
        // Afficher/masquer le select de parent
        if (parentWrapper) {
          parentWrapper.style.display = isChecked ? 'block' : 'none';
        }
        
        // Si on décoche, réinitialiser le parent à null
        if (!isChecked && parentSelect) {
          parentSelect.value = '';
          
          // Modifier localement (sans sauvegarder)
          const section = findSectionById(sectionId, sectionsTree);
          if (section) {
            section.parent = null;
            console.log('✅ Parent désactivé (modifications en mémoire, non sauvegardées)');
          }
        } else if (isChecked && parentSelect) {
          // Si on coche et qu'il n'y a pas de parent sélectionné, mettre le parent par défaut
          const section = findSectionById(sectionId, sectionsTree);
          if (section && !parentSelect.value) {
            // Trouver le parent dans l'arbre structurel
            const structuralParent = findParentSection(sectionId, sectionsTree);
            if (structuralParent) {
              parentSelect.value = structuralParent.id;
              section.parent = structuralParent.id;
              console.log('✅ Parent par défaut appliqué:', structuralParent.title);
            }
          }
        }
      });
    }

    // Changement de section parente (juste mettre à jour l'UI, pas d'application immédiate)
    // Les changements seront appliqués au clic sur "Valider"

    // Changement de catégorie (juste mettre à jour l'UI, pas d'application immédiate)
    // Les changements seront appliqués au clic sur "Valider"
  }

  /**
   * Fonction interne pour charger les options (utilisée par sidebar et modal)
   */
  async function loadOptionsListInternal(optionsList, context = 'modal') {
    if (!optionsList) {
      console.warn('optionsList non trouvé dans loadOptionsListInternal');
      return;
    }

    console.log('🔍 loadOptionsListInternal appelé, context:', context);
    console.log('   sectionsTree:', sectionsTree?.length || 0, 'sections');

    // Si le document n'est pas encore chargé
    if (!sectionsTree || sectionsTree.length === 0) {
      console.log('   ⚠️ sectionsTree vide, affichage message d\'attente');
      optionsList.innerHTML = '<p class="text-muted">Aucune section trouvée. Le document est peut-être en cours de chargement...</p>';
      return;
    }

    // Collecter toutes les sections (structurelles et optionnelles)
    const allSections = [];
    const optionalSections = [];
    const collectSections = (sections, level = 0) => {
      sections.forEach(section => {
        const structure = section.structure || 'structural';
        allSections.push({ ...section, level, structure });
        if (structure === 'optional') {
          optionalSections.push(section);
        }
        if (Array.isArray(section.children)) {
          collectSections(section.children, level + 1);
        }
      });
    };
    collectSections(sectionsTree);

    console.log('   📋 Sections totales:', allSections.length, '| Optionnelles:', optionalSections.length);

    // Générer le HTML
    let html = '';

    // Section sélectionnée : Afficher ses propriétés si une section est sélectionnée
    const selectedSectionElement = document.querySelector('.section-selected');
    if (selectedSectionElement) {
      const selectedSectionId = selectedSectionElement.dataset.sectionId;
      const selectedSection = findSectionByIdInTree(selectedSectionId, sectionsTree);
      if (selectedSection) {
        html += displaySectionOptionsProperties(selectedSection.section || selectedSection);
      }
    } else {
      html += `
        <div class="options-section">
          <p class="text-muted">Cliquez sur une section dans le contenu ou le sommaire pour voir et modifier ses propriétés d'option.</p>
        </div>
      `;
    }

    // Section 2 : Options existantes (actives et inactives)
    if (optionalSections.length > 0) {
      // Séparer les options actives et inactives
      const activeOptions = optionalSections.filter(s => s.actif === true);
      const inactiveOptions = optionalSections.filter(s => s.actif !== true);

      // Grouper par catégorie (gérer les tableaux de catégories)
      const byCategory = {};
      optionalSections.forEach(section => {
        // Normaliser les catégories : convertir string en tableau si nécessaire
        let categories = section.category || [];
        if (typeof categories === 'string') {
          categories = categories ? [categories] : [];
        }
        if (!Array.isArray(categories)) {
          categories = [];
        }
        
        // Si aucune catégorie, utiliser "Sans catégorie"
        if (categories.length === 0) {
          categories = ['Sans catégorie'];
        }
        
        // Ajouter la section à chaque catégorie
        categories.forEach(category => {
          if (!byCategory[category]) {
            byCategory[category] = [];
          }
          byCategory[category].push(section);
        });
      });

      html += `
        <div class="options-section" style="margin-top: 20px;">
          <h5>⚙️ Options configurées</h5>
          <div class="options-categories">
      `;

      Object.keys(byCategory).sort().forEach(category => {
        const categoryOptions = byCategory[category];
        const categoryActive = categoryOptions.filter(s => s.actif === true);
        const categoryInactive = categoryOptions.filter(s => s.actif !== true);

        html += `
          <div class="options-category">
            <h6>${category} <span class="text-muted small">(${categoryActive.length} active${categoryActive.length > 1 ? 's' : ''}, ${categoryInactive.length} inactive${categoryInactive.length > 1 ? 's' : ''})</span></h6>
            <div class="options-category-list">
        `;

        // Afficher d'abord les options actives
        categoryActive.forEach(section => {
          const parentSection = section.parent ? findSectionByIdInTree(section.parent, sectionsTree) : null;
          const parentTitle = parentSection ? (parentSection.section?.title || '(Sans titre)') : 'Racine';
          const isDocument = section.isDocument || false;
          const documentId = section.documentId || null;
          // Normaliser les catégories
          let categories = section.category || [];
          if (typeof categories === 'string') {
            categories = categories ? [categories] : [];
          }
          if (!Array.isArray(categories)) {
            categories = [];
          }
          const categoriesDisplay = categories.length > 0 ? categories.join(', ') : 'Sans catégorie';

          html += `
            <div class="option-item is-active" data-section-id="${section.id}">
              <div class="option-item-header">
                <div class="option-item-info">
                  <h6>${section.title || '(Sans titre)'}</h6>
                  <div class="option-item-meta">
                    <span class="option-meta-item">
                      <strong>Parent:</strong> ${parentTitle}
                    </span>
                    <span class="option-meta-item">
                      <strong>Catégories:</strong> ${categoriesDisplay}
                    </span>
                    ${isDocument && documentId ? `
                      <span class="option-meta-item">
                        <strong>Type:</strong> Document réintégré
                      </span>
                    ` : `
                      <span class="option-meta-item">
                        <strong>Type:</strong> Section
                      </span>
                    `}
                  </div>
                </div>
                <div class="option-item-actions">
                  <label class="checkbox-label">
                    <input type="checkbox" class="option-actif-checkbox" 
                           data-section-id="${section.id}" 
                           checked>
                    <span>Actif</span>
                  </label>
                  ${isDocument && documentId ? `
                    <button class="btn btn-sm btn-outline open-document-btn" 
                            data-document-id="${documentId}">
                      Ouvrir
                    </button>
                  ` : ''}
                  <button class="btn btn-sm btn-outline edit-option-btn" 
                          data-section-id="${section.id}">
                    Éditer
                  </button>
                </div>
              </div>
            </div>
          `;
        });

        // Afficher ensuite les options inactives
        categoryInactive.forEach(section => {
          const parentSection = section.parent ? findSectionByIdInTree(section.parent, sectionsTree) : null;
          const parentTitle = parentSection ? (parentSection.section?.title || '(Sans titre)') : 'Racine';
          const isDocument = section.isDocument || false;
          const documentId = section.documentId || null;
          // Normaliser les catégories
          let categories = section.category || [];
          if (typeof categories === 'string') {
            categories = categories ? [categories] : [];
          }
          if (!Array.isArray(categories)) {
            categories = [];
          }
          const categoriesDisplay = categories.length > 0 ? categories.join(', ') : 'Sans catégorie';

          html += `
            <div class="option-item is-inactive" data-section-id="${section.id}">
              <div class="option-item-header">
                <div class="option-item-info">
                  <h6>${section.title || '(Sans titre)'} <span class="text-muted small">(inactive)</span></h6>
                  <div class="option-item-meta">
                    <span class="option-meta-item">
                      <strong>Parent:</strong> ${parentTitle}
                    </span>
                    <span class="option-meta-item">
                      <strong>Catégories:</strong> ${categoriesDisplay}
                    </span>
                    ${isDocument && documentId ? `
                      <span class="option-meta-item">
                        <strong>Type:</strong> Document réintégré
                      </span>
                    ` : `
                      <span class="option-meta-item">
                        <strong>Type:</strong> Section
                      </span>
                    `}
                  </div>
                </div>
                <div class="option-item-actions">
                  <label class="checkbox-label">
                    <input type="checkbox" class="option-actif-checkbox" 
                           data-section-id="${section.id}">
                    <span>Actif</span>
                  </label>
                  ${isDocument && documentId ? `
                    <button class="btn btn-sm btn-outline open-document-btn" 
                            data-document-id="${documentId}">
                      Ouvrir
                    </button>
                  ` : ''}
                  <button class="btn btn-sm btn-outline edit-option-btn" 
                          data-section-id="${section.id}">
                    Éditer
                  </button>
                </div>
              </div>
            </div>
          `;
        });

        html += `
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="options-section" style="margin-top: 20px;">
          <h5>⚙️ Options configurées</h5>
          <p class="text-muted">Aucune option configurée pour le moment.</p>
        </div>
      `;
    }


    console.log('   ✅ HTML généré, longueur:', html.length);
    console.log('   📝 Avant mise à jour, innerHTML actuel:', optionsList.innerHTML.substring(0, 50));
    optionsList.innerHTML = html;
    console.log('   ✅ optionsList.innerHTML mis à jour, nouveau contenu:', optionsList.innerHTML.substring(0, 100));

    // Attacher les événements pour les propriétés de section dans l'onglet Options
    attachSectionOptionsEvents();

    // Attacher les événements
    optionsList.querySelectorAll('.option-actif-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const sectionId = e.target.dataset.sectionId;
        const active = e.target.checked;

        // Modifier localement (sans sauvegarder)
        const section = findSectionById(sectionId, sectionsTree);
        if (!section) {
          alert('Erreur: Section non trouvée');
          e.target.checked = !active;
          return;
        }

        // Si on active une option, la transformer en structurelle
        if (active && (section.structure || 'structural') === 'optional') {
          // Transformer en structurelle localement
          const success = changeSectionStructureLocal(sectionId, 'structural', null, null);
          if (success) {
            // Mettre à jour l'affichage
            const optionItem = e.target.closest('.option-item');
            if (optionItem) {
              optionItem.classList.toggle('is-active', active);
            }
            // Recharger la liste des options
            loadOptionsListInternal(optionsList, 'modal');
            renderSommaire();
            renderContent();
            console.log('✅ Option transformée en structurelle (modifications en mémoire, non sauvegardées)');
            return;
          }
        }

        // Activation/désactivation simple (mise à jour locale)
        section.actif = active;
        
        // Mettre à jour l'affichage
        const optionItem = e.target.closest('.option-item');
        if (optionItem) {
          optionItem.classList.toggle('is-active', active);
        }
        renderSommaire();
        renderContent();
        console.log('✅ État actif modifié (modifications en mémoire, non sauvegardées)');
      });
    });

    optionsList.querySelectorAll('.open-document-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const docId = e.target.dataset.documentId;
        window.open(`${window.location.origin}${window.location.pathname}?document=${docId}`, '_blank');
      });
    });

    optionsList.querySelectorAll('.edit-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sectionId = e.target.dataset.sectionId;
        const section = findSectionByIdInTree(sectionId, sectionsTree);
        if (section) {
          // Si on est dans le modal canevas, le fermer
          if (context === 'modal') {
            const canvasModal = document.getElementById('canvasModal');
            if (canvasModal) {
              canvasModal.style.display = 'none';
            }
          }
          
          // Basculer vers l'onglet Propriétés dans le sidebar
          const propertiesTab = document.querySelector('[data-properties-tab="properties"]');
          if (propertiesTab) {
            propertiesTab.click();
          }
          
          // Afficher les propriétés de la section
          displaySectionProperties(section.section);
          
          // Scroll vers la section dans le contenu
          const sectionElement = document.querySelector(`.section[data-section-id="${sectionId}"]`);
          if (sectionElement) {
            sectionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Mettre en surbrillance
            document.querySelectorAll('.section').forEach(s => s.classList.remove('section-selected'));
            sectionElement.classList.add('section-selected');
          }
        }
      });
    });
  }

  /**
   * Ouvre un modal pour sélectionner une section à convertir en option
   */
  function openSelectSectionModal() {
    // Pour l'instant, on affiche une liste simple
    // TODO: Créer un vrai modal avec liste des sections structurelles
    const structuralSections = [];
    const collectStructuralSections = (sections) => {
      sections.forEach(section => {
        if (section.structure === 'structural' || section.structure === undefined) {
          structuralSections.push(section);
        }
        if (Array.isArray(section.children)) {
          collectStructuralSections(section.children);
        }
      });
    };
    collectStructuralSections(sectionsTree);

    if (structuralSections.length === 0) {
      alert('Aucune section structurelle disponible');
      return;
    }

    // Créer un prompt simple pour l'instant
    const sectionList = structuralSections.map((s, i) => `${i + 1}. ${s.title || '(Sans titre)'}`).join('\n');
    const choice = prompt(`Sélectionnez une section à convertir en option (entrez le numéro):\n\n${sectionList}`);
    
    if (choice) {
      const index = parseInt(choice) - 1;
      if (index >= 0 && index < structuralSections.length) {
        const section = structuralSections[index];
        // Ouvrir les propriétés de la section pour permettre la conversion
        const canvasModal = document.getElementById('canvasModal');
        if (canvasModal) {
          canvasModal.style.display = 'none';
        }
        displaySectionProperties(section);
        // Scroll vers la section
        const sectionElement = document.querySelector(`.section[data-section-id="${section.id}"]`);
        if (sectionElement) {
          sectionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          document.querySelectorAll('.section').forEach(s => s.classList.remove('section-selected'));
          sectionElement.classList.add('section-selected');
        }
      }
    }
  }

  /**
   * Ouvre le modal pour créer une option document
   */
  function openCreateOptionDocumentModal() {
    const modal = document.getElementById('createOptionDocumentModal');
    const form = document.getElementById('createOptionDocumentForm');
    const categoryInput = document.getElementById('optionDocumentCategory');
    const parentSelect = document.getElementById('optionDocumentParent');
    const titleInput = document.getElementById('optionDocumentTitle');
    const activeCheckbox = document.getElementById('optionDocumentActive');
    const closeBtn = document.getElementById('createOptionDocumentModalClose');
    const cancelBtn = document.getElementById('createOptionDocumentCancel');
    const createBtn = document.getElementById('createOptionDocumentCreate');

    if (!modal) return;

    // Remplir le dropdown des sections parentes
    const allSections = [];
    const collectSections = (sections, level = 0) => {
      sections.forEach(s => {
        allSections.push({ id: s.id, title: s.title || '(Sans titre)', level });
        if (Array.isArray(s.children)) {
          collectSections(s.children, level + 1);
        }
      });
    };
    collectSections(sectionsTree);

    parentSelect.innerHTML = '<option value="">Aucune (racine)</option>' +
      allSections.map(s => 
        `<option value="${s.id}">${'&nbsp;&nbsp;'.repeat(s.level)}${s.title}</option>`
      ).join('');

    // Réinitialiser le formulaire
    if (form) form.reset();
    if (activeCheckbox) activeCheckbox.checked = true;

    // Afficher le modal
    modal.style.display = 'flex';

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

    // Créer l'option document
    if (createBtn) {
      // Retirer les anciens listeners pour éviter les doublons
      const newCreateBtn = createBtn.cloneNode(true);
      createBtn.parentNode.replaceChild(newCreateBtn, createBtn);
      
      newCreateBtn.addEventListener('click', async () => {
        const category = categoryInput.value.trim();
        const parentId = parentSelect.value || null;
        const title = titleInput.value.trim() || 'Nouvelle option';
        const active = activeCheckbox.checked;

        if (!category) {
          alert('Veuillez renseigner une catégorie');
          return;
        }

        try {
          // 1. Créer un nouveau document avec le canevas et les variables hérités
          const newDocId = `option-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Préparer le document avec héritage
          const inheritedCanvas = documentJson?.canvas || null;
          const inheritedVariables = documentJson?.variables || {};
          
          const newDocument = {
            title: title,
            original_filename: null,
            word_file_path: null,
            json_content: {
              sections: [],
              toc: [],
              canvas: inheritedCanvas,
              variables: inheritedVariables,
              metadata: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            },
            metadata: {
              createdAt: new Date(),
              updatedAt: new Date(),
              version: 1
            },
            lockable_properties: {}
          };

          // Créer le document via l'API (PUT crée ou met à jour)
          const createResponse = await fetch(`${apiBase}/agent-documentaire/document/${newDocId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              json_content: newDocument.json_content,
              title: newDocument.title,
              metadata: newDocument.metadata
            })
          });

          const createPayload = await createResponse.json();
          if (!createPayload.success) {
            throw new Error(createPayload.error || 'Erreur lors de la création du document');
          }

          // 2. Créer une section optionnelle dans le document parent
          const sectionId = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Récupérer le document parent
          const parentDocResponse = await fetch(`${apiBase}/agent-documentaire/document/${documentId}`);
          const parentDocPayload = await parentDocResponse.json();
          
          if (!parentDocPayload.success) {
            throw new Error('Erreur lors de la récupération du document parent');
          }

          const parentDoc = parentDocPayload.data;
          if (!Array.isArray(parentDoc.json_content.sections)) {
            parentDoc.json_content.sections = [];
          }

          // Créer la section optionnelle directement
          const newSection = {
            id: sectionId,
            title: title,
            content: [],
            children: [],
            structure: 'optional',
            actif: active,
            parent: parentId,
            category: category,
            isDocument: true,
            documentId: newDocId,
            canvas: inheritedCanvas,
            inheritedVariables: Object.keys(inheritedVariables),
            customVariables: {},
            level: 1
          };

          // Ajouter la section à la racine (elle sera placée sous le parent lors du rendu)
          parentDoc.json_content.sections.push(newSection);

          // Sauvegarder le document parent
          const updateResponse = await fetch(`${apiBase}/agent-documentaire/document/${documentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ json_content: parentDoc.json_content })
          });

          const updatePayload = await updateResponse.json();
          if (!updatePayload.success) {
            throw new Error(updatePayload.error || 'Erreur lors de la création de la section optionnelle');
          }

          // 3. Ouvrir l'éditeur dans un nouvel onglet
          const editorUrl = `${window.location.origin}${window.location.pathname}?document=${newDocId}`;
          window.open(editorUrl, '_blank');

          // 4. Fermer le modal et recharger le document parent
          closeModal();
          await loadDocument();
          
          // Recharger la liste des options si le modal canevas est ouvert
          const optionsPanel = document.querySelector('.canvas-tab-panel[data-panel="options"]');
          if (optionsPanel && optionsPanel.classList.contains('is-active')) {
            loadOptionsList();
          }

          alert('Option document créée avec succès ! L\'éditeur s\'ouvre dans un nouvel onglet.');
        } catch (error) {
          console.error('Erreur création option document:', error);
          alert('Erreur lors de la création de l\'option document : ' + error.message);
        }
      });
    }
  }

  /**
   * Ouvre un modal pour sélectionner un document à réintégrer
   */
  function openReintegrateDocumentModal() {
    // TODO: Implémenter un vrai modal avec liste des documents disponibles
    alert('Fonctionnalité de réintégration de document à venir. Pour l\'instant, créez une option document via "Créer option (document)".');
  }

  /**
   * Initialise les onglets des panneaux de propriétés
   */
const variableManager = (() => {
  const state = {
    initialized: false,
    variables: [],
    panels: [],
    contentRoot: null,
    selectedVariableId: null
  };

  const TYPE_LABEL = {
    text: 'Variable',
    table: 'Tableau'
  };

  const OCC_CLASS = 'doc-variable-occurrence';
  const HIGHLIGHT_CLASS = 'variable-highlight';

  function init() {
    if (state.initialized) return;
    const panelEls = document.querySelectorAll('[data-variable-panel]');
    if (!panelEls.length) return;

    state.initialized = true;
    state.contentRoot = document.querySelector('[data-content-area]');

    panelEls.forEach(registerPanel);

    if (state.contentRoot) {
      state.contentRoot.addEventListener('dragover', handleContentDragOver);
      state.contentRoot.addEventListener('drop', handleContentDrop);
      
      // Observer les suppressions d'occurrences dans le DOM
      setupOccurrenceDeletionObserver();
      
      // Écouter les événements de suppression (Delete, Backspace)
      state.contentRoot.addEventListener('keydown', handleContentKeyDown);
    }

    renderPanels();
  }
  
  function setupOccurrenceDeletionObserver() {
    if (!state.contentRoot) return;
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          // Vérifier si le nœud supprimé est une occurrence ou en contient
          if (node.nodeType === Node.ELEMENT_NODE) {
            const occurrences = node.classList?.contains(OCC_CLASS)
              ? [node]
              : node.querySelectorAll?.(`.${OCC_CLASS}`);
            
            if (occurrences && occurrences.length > 0) {
              Array.from(occurrences).forEach((occElement) => {
                const occurrenceId = occElement.dataset?.occurrenceId;
                if (occurrenceId) {
                  removeOccurrenceFromVariable(occurrenceId);
                }
              });
            }
          }
        });
      });
    });
    
    observer.observe(state.contentRoot, {
      childList: true,
      subtree: true
    });
  }
  
  function handleContentKeyDown(event) {
    // Détecter Delete ou Backspace
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    
    // Vérifier si on est en train de supprimer une occurrence
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const startContainer = range.startContainer;
    
    // Vérifier si on supprime une occurrence
    let targetElement = null;
    if (startContainer.nodeType === Node.TEXT_NODE) {
      targetElement = startContainer.parentElement;
    } else {
      targetElement = startContainer;
    }
    
    if (targetElement && targetElement.classList.contains(OCC_CLASS)) {
      // On supprime une occurrence, laisser le comportement par défaut
      // Le MutationObserver la détectera
      return;
    }
    
    // Vérifier si la sélection contient une occurrence
    const commonAncestor = range.commonAncestorContainer;
    const occurrences = commonAncestor.nodeType === Node.ELEMENT_NODE
      ? commonAncestor.querySelectorAll(`.${OCC_CLASS}`)
      : commonAncestor.parentElement?.querySelectorAll(`.${OCC_CLASS}`);
    
    if (occurrences && occurrences.length > 0) {
      // Vérifier si une occurrence est dans la sélection
      Array.from(occurrences).forEach((occElement) => {
        if (range.intersectsNode(occElement)) {
          // L'occurrence sera supprimée, le MutationObserver la détectera
          return;
        }
      });
    }
  }
  
  function removeOccurrenceFromVariable(occurrenceId) {
    // Trouver la variable qui contient cette occurrence
    for (const variable of state.variables) {
      const occurrenceIndex = variable.occurrences.findIndex(
        (occ) => occ.id === occurrenceId
      );
      
      if (occurrenceIndex !== -1) {
        // Retirer l'occurrence de la liste
        variable.occurrences.splice(occurrenceIndex, 1);
        
        // Si c'était la variable sélectionnée et qu'elle n'a plus d'occurrences actives, la désélectionner
        if (state.selectedVariableId === variable.id) {
          const activeCount = variable.occurrences.filter(occ => occ.active).length;
          if (activeCount === 0) {
            state.selectedVariableId = null;
          }
        }
        
        // Mettre à jour l'affichage
        renderPanels();
        return;
      }
    }
  }

  function registerPanel(panelEl) {
    const panel = {
      el: panelEl,
      form: panelEl.querySelector('[data-variable-form]'),
      typeSelect: panelEl.querySelector('[data-variable-type-select]'),
      patternWrapper: panelEl.querySelector('[data-variable-pattern-wrapper]'),
      hint: panelEl.querySelector('[data-variable-hint]'),
      list: panelEl.querySelector('[data-variable-list]'),
      tabsGroup: panelEl.querySelector('[data-variable-tabs]'),
      sectionsWrapper: panelEl.querySelector('[data-variable-sections]')
    };

    if (panel.form) {
      panel.form.addEventListener('submit', (event) => {
        event.preventDefault();
        handleFormSubmit(panel, new FormData(panel.form));
      });
    }

    if (panel.typeSelect) {
      panel.typeSelect.addEventListener('change', () => updatePatternVisibility(panel));
    }

    if (panel.list) {
      panel.list.addEventListener('click', handleVariableListClick);
      panel.list.addEventListener('dragstart', handleVariableDragStart);
    }

    setupVariableTabs(panel);
    updatePatternVisibility(panel);
    state.panels.push(panel);
  }

  function setupVariableTabs(panel) {
    if (!panel.tabsGroup || !panel.sectionsWrapper) return;
    const tabs = Array.from(panel.tabsGroup.querySelectorAll('[data-variable-tab]'));
    const sections = Array.from(panel.sectionsWrapper.querySelectorAll('[data-variable-section]'));

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.variableTab;
        const targetSection = sections.find((section) => section.dataset.variableSection === target);
        if (!targetSection) return;
        tabs.forEach((btn) => btn.classList.toggle('is-active', btn === tab));
        sections.forEach((section) => section.classList.toggle('is-active', section === targetSection));
        if (target !== 'list') {
          selectVariable(null, { force: true });
        }
      });
    });
  }

  function updatePatternVisibility(panel) {
    if (!panel.patternWrapper || !panel.typeSelect) return;
    const currentType = panel.typeSelect.value;
    if (currentType === 'text') {
      panel.patternWrapper.style.display = '';
      if (panel.hint) {
        panel.hint.innerHTML = '<p class="text-muted">Indiquez le texte exact qui sera remplacé par cette variable.</p>';
      }
    } else {
      panel.patternWrapper.style.display = 'none';
      if (panel.hint) {
        panel.hint.innerHTML = '<p class="text-muted">La configuration des tableaux sera disponible prochainement.</p>';
      }
    }
  }

  function handleFormSubmit(panel, formData) {
    const name = (formData.get('variableName') || '').trim();
    const type = formData.get('variableType') === 'table' ? 'table' : 'text';
    const pattern = (formData.get('variablePattern') || '').trim();

    if (!name) {
      alert('Merci de renseigner un nom de variable.');
      return;
    }

    if (type === 'text' && !pattern) {
      alert('Veuillez fournir le texte à remplacer.');
      return;
    }

    if (state.variables.some((variable) => variable.name.toLowerCase() === name.toLowerCase())) {
      alert('Une variable avec ce nom existe déjà.');
      return;
    }

    const variable = {
      id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      type,
      pattern,
      occurrences: []
    };

    if (type === 'text' && pattern) {
      variable.occurrences = wrapOccurrences(variable, pattern);
      if (!variable.occurrences.length) {
        alert('Aucune occurrence trouvée dans le document. La variable est créée sans remplacement.');
      }
    }

    state.variables.push(variable);
    renderPanels();
    panel.form.reset();
    updatePatternVisibility(panel);
  }

  function wrapOccurrences(variable, pattern) {
    const root = state.contentRoot;
    if (!root || !pattern) return [];

    const nodes = collectTextNodes(root);
    const occurrences = [];

    nodes.forEach((node) => {
      if (!node.parentElement || node.parentElement.closest(`.${OCC_CLASS}`)) {
        return;
      }

      const text = node.nodeValue;
      if (!text || !text.includes(pattern)) {
        return;
      }

      occurrences.push(...splitNodeForPattern(node, variable, pattern));
    });

    return occurrences;
  }

  function collectTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let current = walker.nextNode();
    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }
    return nodes;
  }

  function splitNodeForPattern(node, variable, pattern) {
    const results = [];
    let currentNode = node;
    let remaining = node.nodeValue;

    while (remaining) {
      const index = remaining.indexOf(pattern);
      if (index === -1) break;

      const before = currentNode;
      const matchNode = before.splitText(index);
      const afterNode = matchNode.splitText(pattern.length);
      const span = createOccurrenceSpan(variable, matchNode.nodeValue);
      matchNode.parentNode.replaceChild(span, matchNode);
      results.push(createOccurrenceRecord(variable, span, matchNode.nodeValue));
      currentNode = afterNode;
      remaining = afterNode.nodeValue;
    }

    return results;
  }

  function createOccurrenceSpan(variable, text) {
    const span = document.createElement('span');
    span.classList.add(OCC_CLASS);
    span.dataset.variableId = variable.id;
    span.dataset.originalText = text;
    span.textContent = text;
    return span;
  }

  function createOccurrenceRecord(variable, element, originalText) {
    const id = `occ_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    element.dataset.occurrenceId = id;
    return {
      id,
      variableId: variable.id,
      element,
      originalText,
      active: true
    };
  }

  function renderPanels() {
    cleanupOccurrences();
    state.panels.forEach((panel) => renderPanel(panel));
    updateSelectionClasses();
    applySelectionHighlight();
  }

  function cleanupOccurrences() {
    state.variables.forEach((variable) => {
      variable.occurrences = variable.occurrences.filter((occurrence) => {
        // Garder les occurrences actives si l'élément existe dans le DOM
        if (occurrence.active && occurrence.element) {
          return document.contains(occurrence.element);
        }
        // Garder les occurrences désactivées si le nœud texte existe dans le DOM
        if (!occurrence.active && occurrence.textNode) {
          return document.contains(occurrence.textNode);
        }
        // Sinon, retirer l'occurrence
        return false;
      });
    });
  }

  function renderPanel(panel) {
    if (!panel.list) return;
    panel.list.innerHTML = '';

    if (!state.variables.length) {
      const empty = document.createElement('p');
      empty.className = 'variable-empty';
      empty.textContent = 'Aucune variable définie pour le moment.';
      panel.list.appendChild(empty);
      return;
    }

    state.variables.forEach((variable) => {
      panel.list.appendChild(buildVariableItem(variable));
    });
  }

  function buildVariableItem(variable) {
    const item = document.createElement('div');
    item.className = 'variable-item';
    item.dataset.variableId = variable.id;
    item.dataset.variableItem = 'true';
    item.setAttribute('draggable', variable.type === 'text');

    const header = document.createElement('div');
    header.className = 'variable-item__header';

    const info = document.createElement('div');
    const nameEl = document.createElement('div');
    nameEl.className = 'variable-name';
    nameEl.textContent = variable.name;
    const typeEl = document.createElement('span');
    typeEl.className = 'variable-type';
    typeEl.textContent = TYPE_LABEL[variable.type] || variable.type;
    info.appendChild(nameEl);
    info.appendChild(typeEl);
    header.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'variable-actions';

    if (variable.type === 'text') {
      const activeCount = variable.occurrences.filter(occ => occ.active).length;
      const totalCount = variable.occurrences.length;
      const count = document.createElement('span');
      count.className = 'variable-occurrence-count';
      if (activeCount === totalCount) {
        count.textContent = `${activeCount} occurrence${activeCount > 1 ? 's' : ''}`;
      } else {
        count.textContent = `${activeCount}/${totalCount} occurrence${totalCount > 1 ? 's' : ''}`;
      }
      actions.appendChild(count);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'variable-action-btn';
    deleteBtn.dataset.variableAction = 'delete';
    deleteBtn.textContent = 'Supprimer';
    actions.appendChild(deleteBtn);
    header.appendChild(actions);

    item.appendChild(header);

    if (variable.type === 'text') {
      const list = document.createElement('div');
      list.className = 'variable-occurrence-list';
      if (!variable.occurrences.length) {
        const empty = document.createElement('span');
        empty.className = 'variable-empty';
        empty.textContent = 'Aucune occurrence trouvée.';
        list.appendChild(empty);
      } else {
        variable.occurrences.forEach((occurrence, index) => {
          const chipContainer = document.createElement('div');
          chipContainer.className = 'variable-occurrence-chip-container';
          if (!occurrence.active) {
            chipContainer.classList.add('is-disabled');
          }
          
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'variable-occurrence-checkbox';
          checkbox.dataset.variableAction = 'toggle-occurrence';
          checkbox.dataset.occurrenceId = occurrence.id;
          checkbox.checked = occurrence.active;
          checkbox.title = occurrence.active ? 'Désactiver cette occurrence' : 'Activer cette occurrence';
          chipContainer.appendChild(checkbox);
          
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'variable-occurrence-chip';
          chip.dataset.variableAction = 'focus';
          chip.dataset.occurrenceId = occurrence.id;
          chip.textContent = `Occurrence ${index + 1}`;
          if (!occurrence.active) {
            chip.classList.add('is-disabled');
          }
          chipContainer.appendChild(chip);
          
          list.appendChild(chipContainer);
        });
      }
      item.appendChild(list);
    } else {
      const placeholder = document.createElement('p');
      placeholder.className = 'variable-empty';
      placeholder.textContent = 'Gestion des tableaux disponible prochainement.';
      item.appendChild(placeholder);
    }

    return item;
  }

  function handleVariableListClick(event) {
    const actionBtn = event.target.closest('[data-variable-action]');
    if (actionBtn) {
      handleVariableAction(actionBtn);
      return;
    }

    const item = event.target.closest('[data-variable-item]');
    if (!item) {
      selectVariable(null, { force: true });
      return;
    }

    const variableId = item.dataset.variableId;
    selectVariable(variableId);
  }

  function handleVariableAction(actionBtn) {
    const item = actionBtn.closest('[data-variable-item]');
    if (!item) return;

    const variableId = item.dataset.variableId;
    const action = actionBtn.dataset.variableAction;

    if (action === 'delete') {
      removeVariable(variableId);
      return;
    }

    if (action === 'focus') {
      const occurrenceId = actionBtn.dataset.occurrenceId;
      const variable = state.variables.find((v) => v.id === variableId);
      if (variable) {
        const occurrence = variable.occurrences.find((occ) => occ.id === occurrenceId);
        // Ne focuser que si l'occurrence est active
        if (occurrence && occurrence.active) {
          selectVariable(variableId, { force: true, focusOccurrenceId: occurrenceId });
        }
      }
      return;
    }

    if (action === 'toggle-occurrence') {
      const occurrenceId = actionBtn.dataset.occurrenceId;
      toggleOccurrence(variableId, occurrenceId);
      return;
    }
  }

  function handleVariableDragStart(event) {
    const item = event.target.closest('[data-variable-item]');
    if (!item) return;
    const variableId = item.dataset.variableId;
    if (!variableId) return;
    const variable = state.variables.find((v) => v.id === variableId);
    if (!variable || variable.type !== 'text') return;
    event.dataTransfer.setData('text/variable-id', variableId);
    event.dataTransfer.effectAllowed = 'copy';
  }

  function handleContentDragOver(event) {
    if (event.dataTransfer && event.dataTransfer.types.includes('text/variable-id')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleContentDrop(event) {
    const variableId = event.dataTransfer ? event.dataTransfer.getData('text/variable-id') : null;
    if (!variableId) return;
    const variable = state.variables.find((v) => v.id === variableId);
    if (!variable || variable.type !== 'text') return;
    event.preventDefault();
    event.stopPropagation();
    
    // Ignorer si on drop sur un élément interactif ou sur une occurrence de variable existante
    const target = event.target;
    if (target.closest('button, a, .variable-occurrence-chip, .variable-occurrence-remove, [data-variable-action]')) {
      return;
    }
    
    // Obtenir la position exacte du drop
    const range = caretRangeFromPoint(event.clientX, event.clientY);
    if (!range) {
      showDropErrorMessage('Impossible de déterminer la position du drop');
      return;
    }
    
    // Vérifier que le drop est dans une section valide
    if (!isInValidSection(range.startContainer)) {
      showDropErrorMessage('La variable doit être déposée dans une section (paragraphe, titre, etc.)');
      return;
    }
    
    const success = insertOccurrenceAtRange(variable, range);
    if (success) {
      renderPanels();
    } else {
      showDropErrorMessage('Impossible d\'insérer la variable à cet endroit');
    }
  }
  
  function showDropErrorMessage(message) {
    // Créer un message temporaire pour informer l'utilisateur
    const messageEl = document.createElement('div');
    messageEl.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #dc2626;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-size: 14px;
      pointer-events: none;
    `;
    messageEl.textContent = message;
    document.body.appendChild(messageEl);
    
    // Retirer le message après 3 secondes
    setTimeout(() => {
      messageEl.style.opacity = '0';
      messageEl.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.parentNode.removeChild(messageEl);
        }
      }, 300);
    }, 3000);
  }

  function caretRangeFromPoint(x, y) {
    // Essayer d'abord avec l'API moderne
    if (document.caretRangeFromPoint) {
      try {
        const range = document.caretRangeFromPoint(x, y);
        if (range) {
          return range;
        }
      } catch (e) {
        // Fallback si l'API échoue
      }
    }
    
    // Fallback pour les anciens navigateurs
    if (document.caretPositionFromPoint) {
      try {
        const position = document.caretPositionFromPoint(x, y);
        if (position) {
          const range = document.createRange();
          range.setStart(position.offsetNode, position.offset);
          range.collapse(true);
          return range;
        }
      } catch (e) {
        // Fallback si l'API échoue
      }
    }
    
    // Dernier recours : trouver l'élément sous le curseur et créer un range
    const elementBelow = document.elementFromPoint(x, y);
    if (elementBelow) {
      // Chercher une section valide dans l'élément ou ses parents
      let validSection = elementBelow;
      while (validSection && validSection !== state.contentRoot) {
        if (isInValidSection(validSection)) {
          break;
        }
        validSection = validSection.parentElement;
      }
      
      if (validSection && validSection !== state.contentRoot) {
        // Chercher le nœud texte le plus proche dans la section valide
        const walker = document.createTreeWalker(
          validSection,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let textNode = walker.nextNode();
        if (textNode) {
          const range = document.createRange();
          // Essayer de trouver la position dans le texte en fonction de la position du curseur
          const rect = textNode.getBoundingClientRect();
          const relativeX = x - rect.left;
          const textLength = textNode.textContent.length;
          // Estimation approximative de la position (peut être améliorée)
          const estimatedOffset = Math.round((relativeX / rect.width) * textLength);
          const offset = Math.max(0, Math.min(estimatedOffset, textLength));
          range.setStart(textNode, offset);
          range.collapse(true);
          return range;
        }
        
        // Si pas de nœud texte, insérer à la fin de la section
        const range = document.createRange();
        range.selectNodeContents(validSection);
        range.collapse(false);
        return range;
      }
    }
    
    return null;
  }

  function createRangeAtEnd() {
    if (!state.contentRoot) return null;
    const range = document.createRange();
    range.selectNodeContents(state.contentRoot);
    range.collapse(false);
    return range;
  }

  /**
   * Vérifie si un nœud appartient à une section valide (paragraphe, titre, etc.)
   */
  function isInValidSection(node) {
    if (!node) return false;
    
    // Si c'est un nœud texte, vérifier son parent
    let element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element) return false;
    
    // Vérifier si l'élément ou un de ses ancêtres est une section valide
    while (element && element !== state.contentRoot) {
      const tagName = element.tagName?.toUpperCase();
      // Sections valides : paragraphes, titres, listes
      if (tagName === 'P' || 
          tagName === 'H1' || tagName === 'H2' || tagName === 'H3' || 
          tagName === 'H4' || tagName === 'H5' || tagName === 'H6' ||
          tagName === 'LI' || tagName === 'TD' || tagName === 'TH' ||
          element.classList?.contains('section') ||
          element.classList?.contains('editable-text')) {
        return true;
      }
      element = element.parentElement;
    }
    
    return false;
  }

  function insertOccurrenceAtRange(variable, range) {
    if (!range) return false;
    
    // Vérifier que l'insertion se fait dans une section valide
    const container = range.startContainer;
    if (!isInValidSection(container)) {
      console.warn('Impossible d\'insérer la variable : elle doit être dans une section (paragraphe, titre, etc.)');
      return false;
    }
    
    const text = variable.pattern || variable.name;
    const span = createOccurrenceSpan(variable, text);
    const occurrence = createOccurrenceRecord(variable, span, text);
    
    const offset = range.startOffset;
    
    try {
      if (container.nodeType === Node.TEXT_NODE) {
        // Insérer dans un nœud texte
        const parent = container.parentNode;
        if (!parent || !isInValidSection(parent)) {
          console.warn('Impossible d\'insérer la variable : parent invalide');
          return false;
        }
        
        if (offset === 0) {
          // Insérer au début du nœud texte
          parent.insertBefore(span, container);
        } else if (offset >= container.textContent.length) {
          // Insérer à la fin du nœud texte
          if (container.nextSibling) {
            parent.insertBefore(span, container.nextSibling);
          } else {
            parent.appendChild(span);
          }
        } else {
          // Insérer au milieu : diviser le nœud texte
          const afterNode = container.splitText(offset);
          parent.insertBefore(span, afterNode);
        }
      } else if (container.nodeType === Node.ELEMENT_NODE) {
        // Vérifier que l'élément est une section valide
        if (!isInValidSection(container)) {
          console.warn('Impossible d\'insérer la variable : élément invalide');
          return false;
        }
        
        // Insérer dans un élément (paragraphe, div, etc.)
        const children = Array.from(container.childNodes);
        if (offset < children.length && children[offset]) {
          // Insérer avant l'enfant à l'index offset
          container.insertBefore(span, children[offset]);
        } else {
          // Insérer à la fin de l'élément
          container.appendChild(span);
        }
      } else {
        // Cas par défaut : trouver une section valide dans le parent
        const parent = container.parentNode;
        if (parent && isInValidSection(parent)) {
          if (container.nextSibling) {
            parent.insertBefore(span, container.nextSibling);
          } else {
            parent.appendChild(span);
          }
        } else {
          console.warn('Impossible d\'insérer la variable : aucune section valide trouvée');
          return false;
        }
      }
      
      variable.occurrences.push(occurrence);
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'insertion de l\'occurrence:', error);
      return false;
    }
  }

  function removeVariable(variableId) {
    const index = state.variables.findIndex((v) => v.id === variableId);
    if (index === -1) return;
    const variable = state.variables[index];
    variable.occurrences.forEach(unwrapOccurrence);
    state.variables.splice(index, 1);
    if (state.selectedVariableId === variableId) {
      state.selectedVariableId = null;
    }
    renderPanels();
  }

  function toggleOccurrence(variableId, occurrenceId) {
    const variable = state.variables.find((v) => v.id === variableId);
    if (!variable) return;
    
    const occurrence = variable.occurrences.find((occ) => occ.id === occurrenceId);
    if (!occurrence) return;
    
    if (occurrence.active) {
      // Désactiver : remettre le texte original
      if (occurrence.element && occurrence.element.parentNode) {
        const textNode = document.createTextNode(occurrence.originalText || occurrence.element.textContent || '');
        // Stocker une référence au nœud texte pour pouvoir le retrouver lors de la réactivation
        occurrence.textNode = textNode;
        occurrence.element.replaceWith(textNode);
        occurrence.element = null; // Marquer comme désactivé
      }
      occurrence.active = false;
    } else {
      // Activer : réappliquer le span avec la variable
      if (!occurrence.element && occurrence.textNode && occurrence.textNode.parentNode) {
        // Remplacer le nœud texte par le span
        const span = createOccurrenceSpan(variable, occurrence.originalText);
        span.dataset.occurrenceId = occurrence.id;
        occurrence.textNode.replaceWith(span);
        occurrence.element = span;
        occurrence.textNode = null;
      }
      occurrence.active = true;
    }
    
    renderPanels();
  }

  function unwrapOccurrence(occurrence) {
    if (!occurrence.element || !occurrence.element.parentNode) return;
    const textNode = document.createTextNode(occurrence.originalText || occurrence.element.textContent || '');
    occurrence.element.replaceWith(textNode);
  }

  function selectVariable(variableId, options = {}) {
    const { force = false, focusOccurrenceId } = options;
    const targetId = variableId || null;
    if (!targetId) {
      state.selectedVariableId = null;
      updateSelectionClasses();
      applySelectionHighlight();
      return;
    }
    const sameSelection = state.selectedVariableId === targetId;
    state.selectedVariableId = sameSelection && !force ? null : targetId;
    updateSelectionClasses();
    applySelectionHighlight(focusOccurrenceId);
  }

  function updateSelectionClasses() {
    state.panels.forEach((panel) => {
      if (!panel.list) return;
      panel.list.querySelectorAll('[data-variable-item]').forEach((item) => {
        item.classList.toggle('is-selected', item.dataset.variableId === state.selectedVariableId);
      });
    });
  }

  function applySelectionHighlight(focusOccurrenceId) {
    clearHighlight();
    if (!state.selectedVariableId) return;
    const variable = state.variables.find((v) => v.id === state.selectedVariableId);
    if (!variable) return;
    variable.occurrences.forEach((occurrence) => {
      if (occurrence.element) {
        occurrence.element.classList.add(HIGHLIGHT_CLASS);
      }
    });

    if (focusOccurrenceId) {
      const target = variable.occurrences.find((occ) => occ.id === focusOccurrenceId);
      if (target?.element) {
        target.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  function clearHighlight() {
    document.querySelectorAll(`.${OCC_CLASS}.${HIGHLIGHT_CLASS}`).forEach((el) => {
      el.classList.remove(HIGHLIGHT_CLASS);
    });
  }

  return {
    init,
    clearSelection: () => selectVariable(null, { force: true })
  };
})();

function initPropertiesTabs() {
    const tabsGroups = document.querySelectorAll('[data-properties-tabs]');
    if (!tabsGroups.length) return;

    tabsGroups.forEach(tabsGroup => {
      const groupId = tabsGroup.dataset.propertiesTabs;
      const panelsContainer = document.querySelector(`[data-properties-panels="${groupId}"]`);
      if (!panelsContainer) return;

      const tabs = Array.from(tabsGroup.querySelectorAll('[data-properties-tab]'));
      const panels = Array.from(panelsContainer.querySelectorAll('[data-properties-panel]'));

      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const target = tab.dataset.propertiesTab;
          const targetPanel = panels.find(panel => panel.dataset.propertiesPanel === target);
          if (!targetPanel) return;

          tabs.forEach(btn => btn.classList.remove('is-active'));
          panels.forEach(panel => panel.classList.remove('is-active'));

          tab.classList.add('is-active');
          targetPanel.classList.add('is-active');
          
          console.log('📑 Onglet cliqué:', target);
          
          // Si on clique sur l'onglet Options dans la vue cards
          if (target === 'options' && groupId === 'card-properties') {
            // Ne rien faire, le formulaire s'affichera quand une option sera sélectionnée
            const optionsList = document.getElementById('optionsListCards');
            if (optionsList) {
              // Si aucune option n'est sélectionnée, afficher un message simple
              const selectedCard = document.querySelector('.section-card.is-selected[data-card-type="option"]');
              if (!selectedCard) {
                optionsList.innerHTML = '<p class="text-muted">Sélectionnez une option pour voir et modifier ses paramètres.</p>';
              }
            }
          } else if (target === 'options') {
            // Vue texte : charger les options dans le sidebar
            loadOptionsListSidebar();
          }
          
          // Si on clique sur l'onglet options-properties dans le panel options
          if (target === 'options-properties' && groupId === 'options-panel') {
            console.log('⚙️ Chargement des propriétés d\'option...');
            loadOptionsListOptionsPanel();
          }
          
          // Désélectionner l'élément si on change d'onglet (sauf si on revient sur "properties")
          if (target !== 'properties') {
            clearSelectedElement();
          }
        });
      });
    });
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
    
    // Pour les images, extraire les dimensions, rotation, ombre et bordures arrondies
    let width = '';
    let height = '';
    let rotation = '';
    let borderRadius = '';
    let boxShadow = '';
    let bevel = '';
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
      
      // Extraire border-radius
      borderRadius = computedStyle.borderRadius || '';
      
      // Extraire box-shadow
      boxShadow = computedStyle.boxShadow || '';
      if (boxShadow === 'none') {
        boxShadow = '';
      }
      
      // Détecter l'effet biseau (bevel) - généralement des box-shadow multiples avec ombres claires et foncées
      // On considère qu'il y a un biseau si box-shadow contient plusieurs ombres avec des couleurs claires et foncées
      if (boxShadow && boxShadow !== 'none') {
        // Vérifier si c'est un effet biseau typique (ombres multiples avec rgba clair et foncé)
        const bevelPatterns = [
          /rgba\(255,\s*255,\s*255/i, // Ombre claire (blanc)
          /rgba\(\d+,\s*\d+,\s*\d+,\s*0\.\d+\)\s+.*inset/i, // Ombre inset
          /rgba\(0,\s*0,\s*0,\s*0\.\d+\)\s+.*rgba\(255/i // Ombre foncée suivie de claire
        ];
        const hasBevelPattern = bevelPatterns.some(pattern => pattern.test(boxShadow));
        if (hasBevelPattern || boxShadow.includes('inset')) {
          bevel = boxShadow; // Conserver la valeur actuelle
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
      rotation: rotation,
      borderRadius: borderRadius,
      boxShadow: boxShadow,
      bevel: bevel
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
      
      // Récupérer l'état de verrouillage depuis l'image (ou par défaut : hauteur verrouillée)
      let imageData = findImageDataFromElement(selectedElement);
      
      // Si l'image n'a pas encore de données, créer une structure par défaut
      if (!imageData) {
        // Essayer de trouver l'image par son src dans sectionsTree
        const imageUrl = selectedElement.src || '';
        const imageName = imageUrl.includes('/image/') 
          ? imageUrl.split('/image/')[1]?.split('?')[0] 
          : imageUrl.split('/').pop();
        
        if (imageName) {
          function findAndInitImage(sections) {
            for (const section of sections) {
              if (section.content && Array.isArray(section.content)) {
                for (const item of section.content) {
                  if (item.type === 'image') {
                    const itemImageName = (item.src || item.name || '').includes('/') 
                      ? (item.src || item.name || '').split('/').pop() 
                      : (item.src || item.name || '');
                    if (itemImageName === imageName) {
                      // Initialiser locked si absent
                      if (!item.locked) {
                        item.locked = { width: false, height: true };
                      }
                      // Initialiser id si absent
                      if (!item.id) {
                        item.id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        // Mettre à jour l'attribut data-image-id sur l'élément
                        selectedElement.dataset.imageId = item.id;
                      }
                      return item;
                    }
                  }
                }
              }
              if (section.children && section.children.length > 0) {
                const found = findAndInitImage(section.children);
                if (found) return found;
              }
            }
            return null;
          }
          imageData = findAndInitImage(sectionsTree);
        }
      }
      
      const widthLocked = imageData?.locked?.width ?? false;
      const heightLocked = imageData?.locked?.height ?? true; // Par défaut : hauteur verrouillée
      
      html += `
        <div class="property-item">
          <span class="property-label">Largeur</span>
          <div class="property-lock-group">
            <input type="text" class="property-input ${widthLocked ? 'is-locked' : ''}" data-property="width" value="${properties.width || ''}" placeholder="auto" ${widthLocked ? 'readonly' : ''}>
            <button class="property-lock-btn ${widthLocked ? 'is-locked' : ''}" data-lock="width" title="${widthLocked ? 'Déverrouiller la largeur' : 'Verrouiller la largeur'}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${widthLocked ? `
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                ` : `
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <line x1="12" y1="16" x2="12" y2="19"></line>
                `}
              </svg>
            </button>
          </div>
        </div>
        <div class="property-item">
          <span class="property-label">Hauteur</span>
          <div class="property-lock-group">
            <input type="text" class="property-input ${heightLocked ? 'is-locked' : ''}" data-property="height" value="${properties.height || ''}" placeholder="auto" ${heightLocked ? 'readonly' : ''}>
            <button class="property-lock-btn ${heightLocked ? 'is-locked' : ''}" data-lock="height" title="${heightLocked ? 'Déverrouiller la hauteur' : 'Verrouiller la hauteur'}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${heightLocked ? `
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                ` : `
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <line x1="12" y1="16" x2="12" y2="19"></line>
                `}
              </svg>
            </button>
          </div>
        </div>
        <div class="property-item">
          <span class="property-label">Rotation</span>
          <div class="property-buttons property-buttons--rotation">
            <button class="property-btn property-btn--rotate-left" data-rotate="left" title="Tourner à gauche (-90°)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 4v6h6"></path>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
            </button>
            <button class="property-btn property-btn--rotate-right" data-rotate="right" title="Tourner à droite (+90°)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 4v6h-6"></path>
                <path d="M20.49 15a9 9 0 1 1 2.13-9.36L23 10"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="property-item">
          <span class="property-label">Bordures arrondies</span>
          <div class="property-effect-group">
            <div class="property-buttons property-buttons--radius">
              <button class="property-btn ${(properties.borderRadius || '') === '' || (properties.borderRadius || '') === '0px' ? 'is-active' : ''}" data-effect="borderRadius" data-value="0px" title="Aucune" style="border-radius: 0px;">
                <span>0</span>
              </button>
              <button class="property-btn ${(properties.borderRadius || '') === '4px' ? 'is-active' : ''}" data-effect="borderRadius" data-value="4px" title="Petit (4px)" style="border-radius: 4px;">
                <span>4</span>
              </button>
              <button class="property-btn ${(properties.borderRadius || '') === '8px' ? 'is-active' : ''}" data-effect="borderRadius" data-value="8px" title="Moyen (8px)" style="border-radius: 8px;">
                <span>8</span>
              </button>
              <button class="property-btn ${(properties.borderRadius || '') === '16px' ? 'is-active' : ''}" data-effect="borderRadius" data-value="16px" title="Grand (16px)" style="border-radius: 16px;">
                <span>16</span>
              </button>
              <div class="property-custom-group">
                <button class="property-btn property-btn--custom ${(properties.borderRadius || '') !== '' && (properties.borderRadius || '') !== '0px' && (properties.borderRadius || '') !== '4px' && (properties.borderRadius || '') !== '8px' && (properties.borderRadius || '') !== '16px' ? 'is-active' : ''}" data-effect="borderRadius" data-value="custom" title="Personnalisé" style="border-radius: ${properties.borderRadius || '0px'};">
                  <span>Personnalisé</span>
                </button>
                <input type="text" class="property-input property-input--custom" data-property="borderRadius" data-custom-input="true" value="${properties.borderRadius || ''}" placeholder="0px">
              </div>
            </div>
            <input type="text" class="property-input property-input--effect" data-property="borderRadius" value="${properties.borderRadius || ''}" placeholder="0px">
          </div>
        </div>
        <div class="property-item">
          <span class="property-label">Ombre</span>
          <div class="property-effect-group">
            <div class="property-buttons property-buttons--shadows">
              <button class="property-btn ${(properties.boxShadow || '') === '' || (properties.boxShadow || '') === 'none' ? 'is-active' : ''}" data-effect="boxShadow" data-value="none" title="Aucune" style="box-shadow: none;">
                <span>Aucune</span>
              </button>
              <button class="property-btn ${(properties.boxShadow || '').includes('rgba(0, 0, 0, 0.35) 0px 5px 15px') ? 'is-active' : ''}" data-effect="boxShadow" data-value="rgba(0, 0, 0, 0.35) 0px 5px 15px" title="Classique" style="box-shadow: rgba(0, 0, 0, 0.35) 0px 5px 15px;">
                <span>Classique</span>
              </button>
              <button class="property-btn ${(properties.boxShadow || '').includes('rgba(50, 50, 93, 0.25) 0px 13px 27px -5px') ? 'is-active' : ''}" data-effect="boxShadow" data-value="rgba(50, 50, 93, 0.25) 0px 13px 27px -5px, rgba(0, 0, 0, 0.3) 0px 8px 16px -8px" title="Douce" style="box-shadow: rgba(50, 50, 93, 0.25) 0px 13px 27px -5px, rgba(0, 0, 0, 0.3) 0px 8px 16px -8px;">
                <span>Douce</span>
              </button>
              <button class="property-btn ${(properties.boxShadow || '').includes('rgba(0, 0, 0, 0.3) 0px 19px 38px') ? 'is-active' : ''}" data-effect="boxShadow" data-value="rgba(0, 0, 0, 0.3) 0px 19px 38px, rgba(0, 0, 0, 0.22) 0px 15px 12px" title="Profonde" style="box-shadow: rgba(0, 0, 0, 0.3) 0px 19px 38px, rgba(0, 0, 0, 0.22) 0px 15px 12px;">
                <span>Profonde</span>
              </button>
              <button class="property-btn ${(properties.boxShadow || '').includes('rgba(0, 0, 0, 0.4) 0px 2px 4px') ? 'is-active' : ''}" data-effect="boxShadow" data-value="rgba(0, 0, 0, 0.4) 0px 2px 4px, rgba(0, 0, 0, 0.3) 0px 7px 13px -3px, rgba(0, 0, 0, 0.2) 0px -3px 0px inset" title="Inset" style="box-shadow: rgba(0, 0, 0, 0.4) 0px 2px 4px, rgba(0, 0, 0, 0.3) 0px 7px 13px -3px, rgba(0, 0, 0, 0.2) 0px -3px 0px inset;">
                <span>Inset</span>
              </button>
              <button class="property-btn ${(properties.boxShadow || '').includes('rgba(0, 0, 0, 0.56) 0px 22px 70px 4px') ? 'is-active' : ''}" data-effect="boxShadow" data-value="rgba(0, 0, 0, 0.56) 0px 22px 70px 4px" title="Intense" style="box-shadow: rgba(0, 0, 0, 0.56) 0px 22px 70px 4px;">
                <span>Intense</span>
              </button>
              <button class="property-btn ${(properties.boxShadow || '').includes('rgba(0, 0, 0, 0.2) 0px 60px 40px -7px') ? 'is-active' : ''}" data-effect="boxShadow" data-value="rgba(0, 0, 0, 0.2) 0px 60px 40px -7px" title="Étendue" style="box-shadow: rgba(0, 0, 0, 0.2) 0px 60px 40px -7px;">
                <span>Étendue</span>
              </button>
              <button class="property-btn ${(properties.boxShadow || '').includes('rgba(0, 0, 0, 0.25) 0px 54px 55px') ? 'is-active' : ''}" data-effect="boxShadow" data-value="rgba(0, 0, 0, 0.25) 0px 54px 55px, rgba(0, 0, 0, 0.12) 0px -12px 30px, rgba(0, 0, 0, 0.12) 0px 4px 6px, rgba(0, 0, 0, 0.17) 0px 12px 13px, rgba(0, 0, 0, 0.09) 0px -3px 5px" title="Multi-couches" style="box-shadow: rgba(0, 0, 0, 0.25) 0px 54px 55px, rgba(0, 0, 0, 0.12) 0px -12px 30px, rgba(0, 0, 0, 0.12) 0px 4px 6px, rgba(0, 0, 0, 0.17) 0px 12px 13px, rgba(0, 0, 0, 0.09) 0px -3px 5px;">
                <span>Multi-couches</span>
              </button>
              <div class="property-custom-group">
                <button class="property-btn property-btn--custom ${(properties.boxShadow || '') !== '' && (properties.boxShadow || '') !== 'none' && !(properties.boxShadow || '').includes('rgba(0, 0, 0, 0.35) 0px 5px 15px') && !(properties.boxShadow || '').includes('rgba(50, 50, 93, 0.25) 0px 13px 27px -5px') && !(properties.boxShadow || '').includes('rgba(0, 0, 0, 0.3) 0px 19px 38px') && !(properties.boxShadow || '').includes('rgba(0, 0, 0, 0.4) 0px 2px 4px') && !(properties.boxShadow || '').includes('rgba(0, 0, 0, 0.56) 0px 22px 70px 4px') && !(properties.boxShadow || '').includes('rgba(0, 0, 0, 0.2) 0px 60px 40px -7px') && !(properties.boxShadow || '').includes('rgba(0, 0, 0, 0.25) 0px 54px 55px') ? 'is-active' : ''}" data-effect="boxShadow" data-value="custom" title="Personnalisé" style="box-shadow: ${properties.boxShadow || 'none'};">
                  <span>Personnalisé</span>
                </button>
                <input type="text" class="property-input property-input--custom" data-property="boxShadow" data-custom-input="true" value="${properties.boxShadow || ''}" placeholder="none">
              </div>
            </div>
            <input type="text" class="property-input property-input--effect" data-property="boxShadow" value="${properties.boxShadow || ''}" placeholder="none">
          </div>
        </div>
        <div class="property-item">
          <span class="property-label">Biseau</span>
          <div class="property-effect-group">
            <div class="property-buttons property-buttons--bevel">
              <button class="property-btn ${(properties.bevel || '') === '' || (properties.bevel || '') === 'none' ? 'is-active' : ''}" data-effect="bevel" data-value="none" title="Aucun" style="box-shadow: none;">
                <span>Aucun</span>
              </button>
              <button class="property-btn ${(properties.bevel || '').includes('rgba(255, 255, 255, 0.5) 0px 1px 0px inset') ? 'is-active' : ''}" data-effect="bevel" data-value="rgba(255, 255, 255, 0.5) 0px 1px 0px inset, rgba(0, 0, 0, 0.3) 0px -1px 0px inset" title="Relief" style="box-shadow: rgba(255, 255, 255, 0.5) 0px 1px 0px inset, rgba(0, 0, 0, 0.3) 0px -1px 0px inset;">
                <span>Relief</span>
              </button>
              <button class="property-btn ${(properties.bevel || '').includes('rgba(0, 0, 0, 0.3) 0px 1px 0px inset') ? 'is-active' : ''}" data-effect="bevel" data-value="rgba(0, 0, 0, 0.3) 0px 1px 0px inset, rgba(255, 255, 255, 0.5) 0px -1px 0px inset" title="Creux" style="box-shadow: rgba(0, 0, 0, 0.3) 0px 1px 0px inset, rgba(255, 255, 255, 0.5) 0px -1px 0px inset;">
                <span>Creux</span>
              </button>
              <button class="property-btn ${(properties.bevel || '').includes('rgba(255, 255, 255, 0.6) 1px 1px 0px inset') ? 'is-active' : ''}" data-effect="bevel" data-value="rgba(255, 255, 255, 0.6) 1px 1px 0px inset, rgba(0, 0, 0, 0.4) -1px -1px 0px inset" title="Élevé" style="box-shadow: rgba(255, 255, 255, 0.6) 1px 1px 0px inset, rgba(0, 0, 0, 0.4) -1px -1px 0px inset;">
                <span>Élevé</span>
              </button>
              <button class="property-btn ${(properties.bevel || '').includes('rgba(0, 0, 0, 0.4) 1px 1px 0px inset') ? 'is-active' : ''}" data-effect="bevel" data-value="rgba(0, 0, 0, 0.4) 1px 1px 0px inset, rgba(255, 255, 255, 0.6) -1px -1px 0px inset" title="Enfoncé" style="box-shadow: rgba(0, 0, 0, 0.4) 1px 1px 0px inset, rgba(255, 255, 255, 0.6) -1px -1px 0px inset;">
                <span>Enfoncé</span>
              </button>
              <button class="property-btn ${(properties.bevel || '').includes('rgba(255, 255, 255, 0.7) 0px 2px 2px inset') ? 'is-active' : ''}" data-effect="bevel" data-value="rgba(255, 255, 255, 0.7) 0px 2px 2px inset, rgba(0, 0, 0, 0.5) 0px -2px 2px inset" title="Douce" style="box-shadow: rgba(255, 255, 255, 0.7) 0px 2px 2px inset, rgba(0, 0, 0, 0.5) 0px -2px 2px inset;">
                <span>Douce</span>
              </button>
              <div class="property-custom-group">
                <button class="property-btn property-btn--custom ${(properties.bevel || '') !== '' && (properties.bevel || '') !== 'none' && !(properties.bevel || '').includes('rgba(255, 255, 255, 0.5) 0px 1px 0px inset') && !(properties.bevel || '').includes('rgba(0, 0, 0, 0.3) 0px 1px 0px inset') && !(properties.bevel || '').includes('rgba(255, 255, 255, 0.6) 1px 1px 0px inset') && !(properties.bevel || '').includes('rgba(0, 0, 0, 0.4) 1px 1px 0px inset') && !(properties.bevel || '').includes('rgba(255, 255, 255, 0.7) 0px 2px 2px inset') ? 'is-active' : ''}" data-effect="bevel" data-value="custom" title="Personnalisé" style="box-shadow: ${properties.bevel || 'none'};">
                  <span>Personnalisé</span>
                </button>
                <input type="text" class="property-input property-input--custom" data-property="bevel" data-custom-input="true" value="${properties.bevel || ''}" placeholder="none">
              </div>
            </div>
            <input type="text" class="property-input property-input--effect" data-property="bevel" value="${properties.bevel || ''}" placeholder="none">
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
   * Affiche les propriétés d'une section dans la colonne de droite
   * @param {Object} section - Section à afficher
   */
  function displaySectionProperties(section) {
    const propertiesArea = document.querySelector('[data-properties-area]');
    if (!propertiesArea || !section) return;

    // Trouver la section dans sectionsTree pour avoir les données complètes
    const fullSection = findSectionByIdInTree(section.id, sectionsTree);
    if (!fullSection) return;

    const sectionData = fullSection.section || fullSection;
    
    // Valeurs par défaut si absentes
    const structure = sectionData.structure || 'structural';
    const actif = sectionData.actif !== undefined ? sectionData.actif : (structure === 'structural' ? true : false);
    const parent = sectionData.parent || null;
    const category = sectionData.category || '';
    const isDocument = sectionData.isDocument || false;
    const documentId = sectionData.documentId || null;

    // Récupérer toutes les sections pour le dropdown parent
    const allSections = [];
    const collectSections = (sections, level = 0) => {
      sections.forEach(s => {
        if (s.id !== sectionData.id) { // Exclure la section actuelle
          allSections.push({ id: s.id, title: s.title || '(Sans titre)', level });
          if (Array.isArray(s.children)) {
            collectSections(s.children, level + 1);
          }
        }
      });
    };
    collectSections(sectionsTree);

    // Créer le HTML (sans les champs d'options - ceux-ci sont dans l'onglet Options)
    let html = `
      <div class="property-item">
        <span class="property-label">Type d'élément</span>
        <span class="property-value">Section</span>
      </div>
      <div class="property-item">
        <span class="property-label">Titre</span>
        <span class="property-value">${sectionData.title || '(Sans titre)'}</span>
      </div>
      <div class="property-item">
        <span class="property-label">Type</span>
        <span class="property-value">${structure === 'structural' ? 'Structurel' : 'Optionnel'}</span>
      </div>
      <div class="property-item">
        <span class="property-label">État</span>
        <span class="property-value">${actif ? 'Actif' : 'Inactif'}</span>
      </div>
    `;

    // Si optionnel, afficher les infos (en lecture seule)
    if (structure === 'optional') {
      const parentSection = parent ? findSectionByIdInTree(parent, sectionsTree) : null;
      const parentTitle = parentSection ? (parentSection.section?.title || '(Sans titre)') : 'Racine';
      
      html += `
        <div class="property-item">
          <span class="property-label">Section parente</span>
          <span class="property-value">${parentTitle}</span>
        </div>
        <div class="property-item">
          <span class="property-label">Catégorie</span>
          <span class="property-value">${category || '(Non définie)'}</span>
        </div>
        <div class="property-item">
          <span class="property-label">Modifier les options</span>
          <span class="property-value">
            <small class="text-muted">Utilisez l'onglet "Options" pour modifier les propriétés d'option de cette section.</small>
          </span>
        </div>
      `;
    }

    // Si c'est un document réintégré
    if (isDocument && documentId) {
      html += `
        <div class="property-item">
          <span class="property-label">Document réintégré</span>
          <div class="property-value">
            <span>Document ID: ${documentId}</span>
            <button class="btn btn-sm btn-outline" id="open-document-btn" data-document-id="${documentId}">
              Ouvrir le document
            </button>
          </div>
        </div>
      `;
    }

    propertiesArea.innerHTML = html;

    // Attacher les événements (seulement pour le bouton ouvrir document)
    const openDocumentBtn = document.getElementById('open-document-btn');

    if (openDocumentBtn) {
      openDocumentBtn.addEventListener('click', (e) => {
        const docId = e.target.dataset.documentId;
        window.open(`${window.location.origin}${window.location.pathname}?document=${docId}`, '_blank');
      });
    }
  }

  /**
   * Trouve une section par son ID dans l'arbre (helper pour displaySectionProperties)
   * @param {string} sectionId - ID de la section
   * @param {Array} sections - Arbre de sections
   * @returns {Object|null} Section trouvée avec { section }
   */
  function findSectionByIdInTree(sectionId, sections) {
    if (!Array.isArray(sections)) return null;

    for (const section of sections) {
      if (section.id === sectionId) {
        return { section };
      }
      if (Array.isArray(section.children)) {
        const found = findSectionByIdInTree(sectionId, section.children);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Trouve les données de l'image depuis l'élément HTML
   * @param {HTMLElement} imgElement - Élément img
   * @returns {Object|null} Données de l'image ou null
   */
  function findImageDataFromElement(imgElement) {
    if (!imgElement || imgElement.tagName !== 'IMG') return null;
    
    // Essayer d'abord avec l'ID de l'image (data-image-id)
    const imageId = imgElement.dataset.imageId;
    if (imageId) {
      const found = findImageById(imageId);
      if (found) return found;
    }
    
    // Fallback : chercher par nom d'image
    const imageUrl = imgElement.src || '';
    const imageName = imageUrl.includes('/image/') 
      ? imageUrl.split('/image/')[1]?.split('?')[0] 
      : imageUrl.split('/').pop();
    
    if (!imageName) return null;
    
    return findImageByName(imageName, sectionsTree);
  }

  /**
   * Récupère la valeur réelle d'un effet depuis l'élément sélectionné
   * @param {string} property - Type d'effet ('borderRadius', 'boxShadow', 'bevel')
   * @returns {string} Valeur réelle
   */
  function getRealEffectValue(property) {
    if (!selectedElement || selectedElement.tagName !== 'IMG') {
      return '';
    }
    
    if (property === 'borderRadius') {
      return selectedElement.style.borderRadius || '';
    } else if (property === 'boxShadow' || property === 'bevel') {
      const boxShadowValue = selectedElement.style.boxShadow || '';
      
      // Vérifier si la valeur CSS correspond à un pattern de bevel
      const isBevel = boxShadowValue && boxShadowValue !== 'none' && (
        boxShadowValue.includes('inset') ||
        /rgba\(255,\s*255,\s*255/i.test(boxShadowValue) ||
        /rgba\(\d+,\s*\d+,\s*\d+,\s*0\.\d+\)\s+.*inset/i.test(boxShadowValue) ||
        /rgba\(0,\s*0,\s*0,\s*0\.\d+\)\s+.*rgba\(255/i.test(boxShadowValue)
      );
      
      if (property === 'bevel') {
        // Pour bevel, retourner la valeur seulement si c'est un bevel
        return isBevel ? boxShadowValue : '';
      } else {
        // Pour boxShadow, retourner la valeur seulement si ce n'est PAS un bevel
        return isBevel ? '' : boxShadowValue;
      }
    }
    return '';
  }

  /**
   * Met à jour l'input avec la valeur réelle depuis l'élément
   * @param {string} property - Type d'effet ('borderRadius', 'boxShadow', 'bevel')
   * @param {boolean} force - Si true, forcer la synchronisation même si l'input a déjà une valeur
   */
  function syncInputWithRealValue(property, force = false) {
    const propertiesArea = document.querySelector('[data-properties-area]');
    if (!propertiesArea) return;
    
    const input = propertiesArea.querySelector(`.property-input--effect[data-property="${property}"]`);
    if (input) {
      // Si force est true ou si l'input est vide, synchroniser avec la valeur réelle
      if (force || !input.value || input.value.trim() === '') {
        const realValue = getRealEffectValue(property);
        input.value = realValue;
      }
    }
  }

  /**
   * Met à jour l'état des boutons d'effets selon la valeur
   * @param {string} property - Type d'effet ('borderRadius', 'boxShadow', 'bevel')
   * @param {string} inputValue - Valeur de l'input
   */
  function updateEffectButtonsState(property, inputValue) {
    const propertiesArea = document.querySelector('[data-properties-area]');
    if (!propertiesArea) return;
    
    const effectButtons = propertiesArea.querySelectorAll(`.property-btn[data-effect="${property}"]`);
    let hasPreset = false;
    
    effectButtons.forEach(btn => {
      const btnValue = btn.dataset.value;
      
      // Ignorer le bouton personnalisé
      if (btnValue === 'custom') {
        return;
      }
      
      // Vérifier si la valeur correspond à un bouton prédéfini
      let isPreset = false;
      if (property === 'borderRadius') {
        isPreset = inputValue === btnValue || (inputValue === '' && btnValue === '0px');
      } else if (property === 'boxShadow' || property === 'bevel') {
        // Pour boxShadow et bevel, vérifier si la valeur correspond exactement à un preset
        isPreset = (inputValue === btnValue) || 
                  (inputValue === '' && btnValue === 'none') ||
                  (btnValue !== 'none' && inputValue === btnValue);
      }
      
      btn.classList.toggle('is-active', isPreset);
      if (isPreset) {
        hasPreset = true;
      }
    });
    
    // Mettre à jour le bouton personnalisé et l'input custom
    const customBtn = propertiesArea.querySelector(`.property-btn--custom[data-effect="${property}"]`);
    const customInput = propertiesArea.querySelector(`.property-input--custom[data-property="${property}"]`);
    
    if (customBtn) {
      if (hasPreset) {
        customBtn.classList.remove('is-active');
      } else {
        customBtn.classList.add('is-active');
        // Mettre à jour le style du bouton personnalisé
        if (property === 'borderRadius') {
          customBtn.style.borderRadius = inputValue || '0px';
          const span = customBtn.querySelector('span');
          if (span) span.textContent = 'Personnalisé';
        } else if (property === 'boxShadow' || property === 'bevel') {
          customBtn.style.boxShadow = inputValue || 'none';
          const span = customBtn.querySelector('span');
          if (span) span.textContent = 'Personnalisé';
        }
      }
    }
    
    // Mettre à jour l'input custom avec la valeur actuelle
    if (customInput) {
      customInput.value = inputValue || '';
    }
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
      const property = input.dataset.property;
      const isEffectInput = property === 'borderRadius' || property === 'boxShadow' || property === 'bevel';
      
      // Pour les effets, utiliser 'input' pour application en temps réel
      if (isEffectInput) {
        input.addEventListener('input', function(e) {
          const inputValue = this.value;
          const prop = this.dataset.property;
          if (selectedElement) {
            // Appliquer l'effet
            applyProperty(prop, inputValue);
            // Mettre à jour l'état des boutons
            updateEffectButtonsState(prop, inputValue.trim());
            // S'assurer que la valeur dans l'input correspond à la valeur réelle
            // (au cas où applyProperty aurait modifié quelque chose)
            if (selectedElement.tagName === 'IMG') {
              let realValue = '';
              if (prop === 'borderRadius') {
                realValue = selectedElement.style.borderRadius || '';
              } else if (prop === 'boxShadow' || prop === 'bevel') {
                realValue = selectedElement.style.boxShadow || '';
              }
              // Si la valeur réelle est différente, la mettre à jour dans l'input
              if (realValue !== inputValue) {
                this.value = realValue;
              }
            }
          }
        });
      }
      
      input.addEventListener('change', function() {
        const prop = this.dataset.property;
        // Vérifier si la propriété est verrouillée
        if (prop === 'width' || prop === 'height') {
          const imageData = findImageDataFromElement(selectedElement);
          const isLocked = prop === 'width' 
            ? (imageData?.locked?.width ?? false)
            : (imageData?.locked?.height ?? true);
          if (isLocked) {
            // Restaurer la valeur originale
            const originalValue = prop === 'width' 
              ? (imageData?.width ? `${imageData.width}px` : '')
              : (imageData?.height ? `${imageData.height}px` : '');
            this.value = originalValue;
            return;
          }
        }
        
        // Pour les effets, ne pas réappliquer (déjà fait dans 'input')
        const isEffect = prop === 'borderRadius' || prop === 'boxShadow' || prop === 'bevel';
        if (!isEffect) {
          applyProperty(prop, this.value);
        }
      });
    });

    // Inputs custom (à côté des boutons personnalisés)
    const customInputs = propertiesArea.querySelectorAll('.property-input--custom');
    customInputs.forEach(customInput => {
      const property = customInput.dataset.property;
      const isEffectInput = property === 'borderRadius' || property === 'boxShadow' || property === 'bevel';
      
      if (isEffectInput) {
        // Quand on tape dans l'input custom, mettre à jour l'input principal
        customInput.addEventListener('input', function() {
          const mainInput = propertiesArea.querySelector(`.property-input--effect[data-property="${property}"]`);
          if (mainInput) {
            mainInput.value = this.value;
            // Appliquer l'effet
            applyProperty(property, this.value);
            // Si bevel ou boxShadow, vider l'input opposé
            if (property === 'bevel' && this.value.trim() !== '') {
              const boxShadowInput = propertiesArea.querySelector(`.property-input--effect[data-property="boxShadow"]`);
              const boxShadowCustomInput = propertiesArea.querySelector(`.property-input--custom[data-property="boxShadow"]`);
              if (boxShadowInput) boxShadowInput.value = '';
              if (boxShadowCustomInput) boxShadowCustomInput.value = '';
              // Désactiver tous les boutons boxShadow
              const boxShadowButtons = propertiesArea.querySelectorAll('.property-btn[data-effect="boxShadow"]');
              boxShadowButtons.forEach(b => b.classList.remove('is-active'));
            } else if (property === 'boxShadow' && this.value.trim() !== '') {
              const bevelInput = propertiesArea.querySelector(`.property-input--effect[data-property="bevel"]`);
              const bevelCustomInput = propertiesArea.querySelector(`.property-input--custom[data-property="bevel"]`);
              if (bevelInput) bevelInput.value = '';
              if (bevelCustomInput) bevelCustomInput.value = '';
              // Désactiver tous les boutons bevel
              const bevelButtons = propertiesArea.querySelectorAll('.property-btn[data-effect="bevel"]');
              bevelButtons.forEach(b => b.classList.remove('is-active'));
              // Activer le bouton "Aucun" pour bevel
              const bevelNoneBtn = propertiesArea.querySelector('.property-btn[data-effect="bevel"][data-value="none"]');
              if (bevelNoneBtn) bevelNoneBtn.classList.add('is-active');
            }
            // Mettre à jour l'état des boutons
            updateEffectButtonsState(property, this.value.trim());
          }
        });
        
        // Quand on valide l'input custom (Enter ou blur), appliquer la valeur
        customInput.addEventListener('change', function() {
          const value = this.value.trim();
          applyProperty(property, value);
          // Mettre à jour l'input principal
          const mainInput = propertiesArea.querySelector(`.property-input--effect[data-property="${property}"]`);
          if (mainInput) {
            mainInput.value = value;
          }
          // Mettre à jour l'état des boutons
          updateEffectButtonsState(property, value);
        });
      }
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

    // Boutons de rotation
    const rotateButtons = propertiesArea.querySelectorAll('.property-btn[data-rotate]');
    rotateButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (!selectedElement || selectedElement.tagName !== 'IMG') return;
        
        const direction = btn.dataset.rotate; // 'left' ou 'right'
        const increment = direction === 'left' ? -90 : 90;
        
        // Récupérer imageData
        const imageData = findImageDataFromElement(selectedElement);
        if (!imageData) return;
        
        // Lire la rotation actuelle depuis imageData.rotation ou depuis le style
        let currentRotation = 0;
        if (imageData.rotation !== undefined && imageData.rotation !== null) {
          // Gérer le cas où rotation est une chaîne ("90deg") ou un nombre (90)
          let rotationValue;
          if (typeof imageData.rotation === 'string') {
            rotationValue = imageData.rotation.replace('deg', '').trim();
          } else {
            rotationValue = imageData.rotation;
          }
          const numericValue = parseFloat(rotationValue);
          if (!isNaN(numericValue)) {
            currentRotation = numericValue;
          }
        } else {
          // Fallback : lire depuis le style
          const currentTransform = selectedElement.style.transform || '';
          const rotationMatch = currentTransform.match(/rotate\(([^)]+)\)/);
          if (rotationMatch) {
            const rotationValue = rotationMatch[1].trim();
            const numericValue = parseFloat(rotationValue);
            if (!isNaN(numericValue)) {
              currentRotation = numericValue;
            }
          }
        }
        
        // Calculer la nouvelle rotation (rotation illimitée)
        const newRotation = currentRotation + increment;
        
        // Sauvegarder la rotation dans imageData
        imageData.rotation = `${newRotation}deg`;
        
        // Appliquer le transform rotate à l'image (on ne change PAS les dimensions de l'image)
        const currentTransform = selectedElement.style.transform || '';
        const otherTransforms = currentTransform.replace(/rotate\([^)]+\)/g, '').trim();
        selectedElement.style.transform = `rotate(${newRotation}deg)${otherTransforms ? ' ' + otherTransforms : ''}`.trim();
        
        // Lire les dimensions logiques de l'image (qui ne changent jamais)
        let Linit = parseFloat(selectedElement.style.width);
        let Hinit = parseFloat(selectedElement.style.height);
        
        // Si pas de dimensions dans le style, utiliser les dimensions naturelles et les définir
        if (!Linit || isNaN(Linit)) {
          Linit = selectedElement.naturalWidth || selectedElement.offsetWidth || 0;
          if (Linit > 0) {
            selectedElement.style.width = `${Linit}px`;
          }
        }
        if (!Hinit || isNaN(Hinit)) {
          Hinit = selectedElement.naturalHeight || selectedElement.offsetHeight || 0;
          if (Hinit > 0) {
            selectedElement.style.height = `${Hinit}px`;
          }
        }
        
        if (!Linit || !Hinit) return;
        
        // Lire les dimensions actuelles du wrapper (pour savoir quelle est la taille visuelle actuelle)
        const wrapper = selectedElement.closest('.image-wrapper');
        let LwrapperActuel = 0;
        let HwrapperActuel = 0;
        if (wrapper) {
          LwrapperActuel = parseFloat(wrapper.style.width) || wrapper.offsetWidth || 0;
          HwrapperActuel = parseFloat(wrapper.style.height) || wrapper.offsetHeight || 0;
        }
        
        // Si le wrapper n'a pas de dimensions, utiliser les dimensions logiques de l'image
        if (!LwrapperActuel || !HwrapperActuel) {
          LwrapperActuel = Linit;
          HwrapperActuel = Hinit;
        }
        
        // Calculer les dimensions cibles du wrapper après rotation
        // À chaque rotation de 90°, on inverse les dimensions du wrapper actuel
        let Lcible = HwrapperActuel;
        let Hcible = LwrapperActuel;
        
        // Calculer le ratio de l'image après rotation (basé sur les dimensions logiques)
        // Après rotation, visuellement on a Hinit x Linit, donc ratio = Linit / Hinit
        const Rcible = Linit / Hinit;
        
        // Vérifier les verrous
        const widthLocked = imageData.locked?.width || false;
        const heightLocked = imageData.locked?.height || false;
        
        if (widthLocked && !heightLocked) {
          // Verrou sur L (largeur logique) : on garde la largeur logique, on calcule la hauteur pour garder le ratio
          // Mais après rotation, la largeur logique devient la hauteur visuelle
          // Donc Hcible = Linit, et Lcible = Hinit (mais on doit ajuster pour le ratio)
          // En fait, si on verrouille la largeur logique, après rotation on verrouille la hauteur visuelle
          // Donc Hcible = Linit, et Lcible = Linit / Rcible
          Hcible = Linit;
          Lcible = Linit / Rcible; // = Linit / (Linit / Hinit) = Hinit
        } else if (heightLocked && !widthLocked) {
          // Verrou sur H (hauteur logique) : on garde la hauteur logique, on calcule la largeur pour garder le ratio
          // Après rotation, la hauteur logique devient la largeur visuelle
          // Donc Lcible = Hinit, et Hcible = Hinit * Rcible
          Lcible = Hinit;
          Hcible = Hinit * Rcible; // = Hinit * (Linit / Hinit) = Linit
        }
        // Si aucun verrou ou les deux verrous : on garde le swap simple (Lcible = HwrapperActuel, Hcible = LwrapperActuel)
        
        // Appliquer UNIQUEMENT les dimensions au wrapper (pas à l'image, sans contraintes min/max pour permettre à l'image de dépasser)
        // wrapper est déjà déclaré plus haut
        if (wrapper) {
          wrapper.style.setProperty('width', `${Lcible}px`, 'important');
          wrapper.style.setProperty('height', `${Hcible}px`, 'important');
          
          // Centrer l'image dans le wrapper après rotation
          // L'image tourne autour de son centre (transform-origin: center center)
          // Le wrapper a les dimensions visuelles après rotation (Lcible x Hcible)
          // L'image a les dimensions logiques (Linit x Hinit)
          // Pour centrer : calculer le décalage entre les dimensions du wrapper et de l'image
          const normalizedRotation = ((newRotation % 360) + 360) % 360;
          
          if (normalizedRotation === 90 || normalizedRotation === 270) {
            // Après rotation 90/270°, visuellement l'image occupe Hinit x Linit
            // Le wrapper doit avoir Lcible = Hinit, Hcible = Linit
            // L'image logique a Linit x Hinit
            // Pour centrer : décalage = (dimensions wrapper - dimensions image logique) / 2
            const deltaWidth = (Lcible - Linit) / 2;
            const deltaHeight = (Hcible - Hinit) / 2;
            selectedElement.style.marginLeft = `${deltaWidth}px`;
            selectedElement.style.marginTop = `${deltaHeight}px`;
          } else {
            // Pour 0° et 180°, dimensions visuelles = dimensions logiques
            const deltaWidth = (Lcible - Linit) / 2;
            const deltaHeight = (Hcible - Hinit) / 2;
            selectedElement.style.marginLeft = `${deltaWidth}px`;
            selectedElement.style.marginTop = `${deltaHeight}px`;
          }
        }
      });
    });

    // Boutons d'effets (bordures arrondies et ombres)
    const effectButtons = propertiesArea.querySelectorAll('.property-btn[data-effect]');
    effectButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const effectType = btn.dataset.effect; // 'borderRadius' ou 'boxShadow'
        const effectValue = btn.dataset.value;
        
        // Si c'est le bouton personnalisé, appliquer la valeur de l'input custom
        if (effectValue === 'custom') {
          // Retirer l'état actif de tous les boutons du même type d'effet
          const sameTypeButtons = propertiesArea.querySelectorAll(`.property-btn[data-effect="${effectType}"]`);
          sameTypeButtons.forEach(b => b.classList.remove('is-active'));
          // Ajouter l'état actif au bouton personnalisé
          btn.classList.add('is-active');
          
          // Récupérer l'input custom à côté du bouton
          const customInput = propertiesArea.querySelector(`.property-input--custom[data-property="${effectType}"]`);
          if (customInput) {
            // Si l'input custom est vide, le remplir avec la valeur actuelle de l'élément
            if (!customInput.value || customInput.value.trim() === '') {
              const realValue = getRealEffectValue(effectType);
              customInput.value = realValue || '';
            }
            
            const customValue = customInput.value.trim();
            // Appliquer la valeur de l'input custom
            if (customValue && customValue !== '') {
              applyProperty(effectType, customValue);
            } else {
              // Si l'input est vide, appliquer une valeur vide
              applyProperty(effectType, '');
            }
            // Mettre à jour l'input principal avec la valeur appliquée
            const mainInput = propertiesArea.querySelector(`.property-input--effect[data-property="${effectType}"]`);
            if (mainInput) {
              mainInput.value = customValue;
            }
            // Mettre à jour l'état des boutons
            updateEffectButtonsState(effectType, customValue);
            // Focus sur l'input custom
            customInput.focus();
            customInput.select();
          }
          return;
        }
        
        // Retirer l'état actif de tous les boutons du même type d'effet
        const sameTypeButtons = propertiesArea.querySelectorAll(`.property-btn[data-effect="${effectType}"]`);
        sameTypeButtons.forEach(b => b.classList.remove('is-active'));
        // Ajouter l'état actif au bouton cliqué
        btn.classList.add('is-active');
        
        // Appliquer l'effet
        if (effectValue === 'none') {
          applyProperty(effectType, '');
        } else {
          applyProperty(effectType, effectValue);
        }
        
        // Mettre à jour l'input correspondant avec la valeur réelle depuis l'élément
        syncInputWithRealValue(effectType);
        
        // Si on applique un bevel, vider l'input boxShadow (et vice versa)
        // car ils utilisent la même propriété CSS
        if (effectType === 'bevel') {
          if (effectValue !== 'none' && effectValue !== 'custom') {
            // Vider l'input boxShadow principal
            const boxShadowInput = propertiesArea.querySelector(`.property-input--effect[data-property="boxShadow"]`);
            if (boxShadowInput) {
              boxShadowInput.value = '';
            }
            // Vider l'input boxShadow custom
            const boxShadowCustomInput = propertiesArea.querySelector(`.property-input--custom[data-property="boxShadow"]`);
            if (boxShadowCustomInput) {
              boxShadowCustomInput.value = '';
            }
            // Désactiver tous les boutons boxShadow
            const boxShadowButtons = propertiesArea.querySelectorAll('.property-btn[data-effect="boxShadow"]');
            boxShadowButtons.forEach(b => b.classList.remove('is-active'));
          }
        } else if (effectType === 'boxShadow') {
          if (effectValue !== 'none' && effectValue !== 'custom') {
            // Vider l'input bevel principal
            const bevelInput = propertiesArea.querySelector(`.property-input--effect[data-property="bevel"]`);
            if (bevelInput) {
              bevelInput.value = '';
            }
            // Vider l'input bevel custom
            const bevelCustomInput = propertiesArea.querySelector(`.property-input--custom[data-property="bevel"]`);
            if (bevelCustomInput) {
              bevelCustomInput.value = '';
            }
            // Désactiver tous les boutons bevel
            const bevelButtons = propertiesArea.querySelectorAll('.property-btn[data-effect="bevel"]');
            bevelButtons.forEach(b => b.classList.remove('is-active'));
            // Activer le bouton "Aucun" pour bevel
            const bevelNoneBtn = propertiesArea.querySelector('.property-btn[data-effect="bevel"][data-value="none"]');
            if (bevelNoneBtn) bevelNoneBtn.classList.add('is-active');
          }
        }
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

    // Boutons de verrouillage (cadenas)
    const lockButtons = propertiesArea.querySelectorAll('.property-lock-btn');
    lockButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const lockType = btn.dataset.lock; // 'width' ou 'height'
        const isLocked = btn.classList.contains('is-locked');
        
        // Toggle le verrouillage (utilise la fonction complète qui met à jour tout)
        const stateChanged = toggleImageLock(lockType, !isLocked);
        if (!stateChanged) return;
        
        // Mettre à jour l'UI du panneau de propriétés
        btn.classList.toggle('is-locked');
        const input = propertiesArea.querySelector(`.property-input[data-property="${lockType}"]`);
        if (input) {
          input.classList.toggle('is-locked');
          input.readOnly = !isLocked;
          // Mettre à jour le titre du bouton
          btn.title = !isLocked 
            ? `Déverrouiller la ${lockType === 'width' ? 'largeur' : 'hauteur'}` 
            : `Verrouiller la ${lockType === 'width' ? 'largeur' : 'hauteur'}`;
        }
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
          // Trouver le conteneur parent (en sautant le wrapper)
          let container = selectedElement.parentElement;
          // Si le parent est le wrapper, prendre son parent
          if (container && container.classList.contains('image-wrapper')) {
            container = container.parentElement;
          }
          
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
          // Vérifier si la largeur est verrouillée
          const imageData = findImageDataFromElement(selectedElement);
          if (imageData?.locked?.width) {
            return; // Ne pas modifier si verrouillée
          }
          selectedElement.style.width = value || '';
          // Mettre à jour les données de l'image
          if (imageData) {
            const numericValue = value ? parseFloat(value) : null;
            imageData.width = numericValue || imageData.width;
          }
        }
        break;
      case 'height':
        if (selectedElement.tagName === 'IMG') {
          // Vérifier si la hauteur est verrouillée
          const imageData = findImageDataFromElement(selectedElement);
          if (imageData?.locked?.height) {
            return; // Ne pas modifier si verrouillée
          }
          selectedElement.style.height = value || '';
          // Mettre à jour les données de l'image
          if (imageData) {
            const numericValue = value ? parseFloat(value) : null;
            imageData.height = numericValue || imageData.height;
          }
        }
        break;
      case 'borderRadius':
        if (selectedElement.tagName === 'IMG') {
          selectedElement.style.borderRadius = value || '';
        }
        break;
      case 'boxShadow':
        if (selectedElement && selectedElement.tagName === 'IMG') {
          // Si un bevel est actif, ne pas appliquer boxShadow (ils utilisent la même propriété CSS)
          const propertiesArea = document.querySelector('[data-properties-area]');
          if (propertiesArea) {
            const bevelInput = propertiesArea.querySelector('.property-input--effect[data-property="bevel"]');
            const bevelValue = bevelInput ? bevelInput.value.trim() : '';
            // Si bevel a une valeur, ne pas appliquer boxShadow
            if (bevelValue && bevelValue !== '' && bevelValue !== 'none') {
              return; // Le bevel a la priorité
            }
          }
          selectedElement.style.boxShadow = value || '';
        }
        break;
      case 'bevel':
        if (selectedElement && selectedElement.tagName === 'IMG') {
          // Pour le bevel, on applique directement la valeur sur boxShadow
          // Le bevel écrase l'ombre normale (boxShadow) car ils utilisent la même propriété CSS
          if (value && value !== 'none' && value !== '') {
            selectedElement.style.boxShadow = value;
          } else {
            selectedElement.style.boxShadow = '';
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
    
    // Ajouter l'événement de double-clic pour le rognage d'image
    contentArea.addEventListener('dblclick', handleImageDoubleClick);
  }

  /**
   * Gère le double-clic sur une image pour ouvrir le modal de rognage
   * @param {Event} e - Événement de double-clic
   */
  function handleImageDoubleClick(e) {
    // Vérifier si on a cliqué sur une image
    let imgElement = e.target;
    if (imgElement.tagName !== 'IMG') {
      imgElement = e.target.closest('img');
    }
    
    if (!imgElement || imgElement.tagName !== 'IMG') return;
    
    // Empêcher la propagation
    e.preventDefault();
    e.stopPropagation();
    
    // Ouvrir le modal de rognage
    openImageCropModal(imgElement);
  }

  /**
   * Initialise le système de rognage d'image
   */
  function initImageCrop() {
    const modal = document.getElementById('imageCropModal');
    if (!modal) return;
    
    const closeBtn = document.getElementById('imageCropModalClose');
    const cancelBtn = document.getElementById('imageCropCancel');
    const saveBtn = document.getElementById('imageCropSave');
    const resetBtn = document.getElementById('imageCropReset');
    
    // Fermer le modal
    if (closeBtn) {
      closeBtn.addEventListener('click', closeImageCropModal);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeImageCropModal);
    }
    
    // Fermer en cliquant sur l'overlay
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeImageCropModal();
      }
    });
    
    // Fermer avec Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display !== 'none') {
        closeImageCropModal();
      }
    });
    
    // Sauvegarder le rognage
    if (saveBtn) {
      saveBtn.addEventListener('click', applyImageCrop);
    }
    
    // Réinitialiser le rognage
    if (resetBtn) {
      resetBtn.addEventListener('click', resetImageCrop);
    }
    
    // Supprimer complètement le rognage
    const deleteBtn = document.getElementById('imageCropDelete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', deleteImageCrop);
      // Masquer par défaut au chargement
      deleteBtn.style.display = 'none';
    } else {
      console.error('❌ Bouton imageCropDelete introuvable dans initImageCrop');
    }
  }

  /**
   * Ouvre le modal de rognage avec l'image
   * @param {HTMLImageElement} imgElement - Élément image à rogner
   */
  function openImageCropModal(imgElement) {
    const modal = document.getElementById('imageCropModal');
    const canvas = document.getElementById('imageCropCanvas');
    if (!modal || !canvas) return;
    
    // Récupérer l'imageData
    const imageData = findImageDataFromElement(imgElement);
    if (!imageData) return;
    
    // Stocker la référence à l'image
    modal.dataset.imageElement = imgElement.getAttribute('data-image-id') || '';
    
    // Utiliser l'URL originale stockée, ou l'URL de l'upload (imageData.src)
    // Ne jamais utiliser imgElement.src car il peut être rogné (data URL)
    let originalSrc = imageData.originalSrc || imageData.src;
    
    // Si aucune URL originale n'est disponible, essayer de récupérer depuis l'élément
    // mais seulement si ce n'est pas un data URL (image rognée)
    if (!originalSrc) {
      const currentSrc = imgElement.src;
      if (!currentSrc.startsWith('data:')) {
        // Ce n'est pas un data URL, c'est peut-être l'originale
        originalSrc = currentSrc;
      }
    }
    
    // Stocker comme originale pour les prochaines fois si ce n'est pas déjà fait
    if (originalSrc && !imageData.originalSrc) {
      imageData.originalSrc = originalSrc;
    }
    
    if (!originalSrc) {
      console.error('Impossible de trouver l\'URL originale de l\'image');
      alert('Impossible de charger l\'image originale pour le rognage');
      return;
    }
    
    // Construire l'URL complète
    let imageSrc = originalSrc;
    
    // Si c'est un data URL (image rognée), ne pas l'utiliser - utiliser l'URL originale à la place
    if (imageSrc && imageSrc.startsWith('data:')) {
      console.warn('⚠️ Image source est un data URL (rognée), utilisation de l\'URL originale à la place');
      // Essayer de récupérer l'URL originale depuis imageData.src ou imageData.originalSrc
      imageSrc = imageData.originalSrc || imageData.src;
      if (!imageSrc || imageSrc.startsWith('data:')) {
        console.error('❌ Impossible de trouver l\'URL originale (non rognée)');
        alert('Impossible de charger l\'image originale pour le rognage');
        return;
      }
    }
    
    // Si c'est déjà une URL complète (http/https), l'utiliser telle quelle
    if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
      // URL complète, utiliser telle quelle
    } else if (imageData.name || imageData.tempImageId) {
      // C'est un nom d'image ou un tempImageId, construire l'URL via l'API
      if (imageData.tempImageId) {
        // Image temporaire
        imageSrc = buildTempImageUrl(imageData.tempImageId);
      } else if (imageData.name) {
        // Image sauvegardée
        imageSrc = buildDocumentImageUrl(imageData.name);
      } else {
        // Essayer avec originalSrc comme nom d'image
        imageSrc = buildDocumentImageUrl(originalSrc);
      }
    } else {
      // URL relative, la convertir en URL absolue
      try {
        // Si l'URL commence par /, utiliser origin comme base
        // Sinon, utiliser window.location.href pour préserver le chemin actuel
        if (imageSrc.startsWith('/')) {
          imageSrc = new URL(imageSrc, window.location.origin).href;
        } else {
          // URL relative sans slash : utiliser le chemin actuel comme base
          imageSrc = new URL(imageSrc, window.location.href).href;
        }
      } catch (e) {
        console.error('Erreur lors de la conversion de l\'URL:', e, originalSrc);
        // En cas d'erreur, essayer avec window.location.href
        imageSrc = new URL(imageSrc, window.location.href).href;
      }
    }
    
    // Stocker l'URL convertie dans le modal
    modal.dataset.imageSrc = imageSrc;
    
    console.log('🖼️ Chargement image pour rognage:', {
      originalSrc: originalSrc,
      convertedSrc: imageSrc,
      windowLocation: window.location.href
    });
    
    // Créer une nouvelle image pour charger l'originale
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      // Ajuster la taille du canvas à l'image
      const maxWidth = 800;
      const maxHeight = 600;
      let canvasWidth = img.width;
      let canvasHeight = img.height;
      
      // Redimensionner si nécessaire pour tenir dans le modal
      if (canvasWidth > maxWidth || canvasHeight > maxHeight) {
        const ratio = Math.min(maxWidth / canvasWidth, maxHeight / canvasHeight);
        canvasWidth = canvasWidth * ratio;
        canvasHeight = canvasHeight * ratio;
      }
      
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      // Dessiner l'image sur le canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      
      // Stocker l'image originale pour la réutiliser
      canvas.originalImage = img;
      
      // Stocker les dimensions originales pour le calcul du rognage
      canvas.dataset.originalWidth = img.width;
      canvas.dataset.originalHeight = img.height;
      canvas.dataset.scaleX = img.width / canvasWidth;
      canvas.dataset.scaleY = img.height / canvasHeight;
      
      // Initialiser le rectangle de rognage
      initCropRectangle(canvas, imageData.crop);
      
      // Afficher/masquer le bouton "Supprimer" selon qu'un rognage existe
      const deleteBtn = document.getElementById('imageCropDelete');
      if (deleteBtn) {
        const hasCrop = imageData.crop && 
                        typeof imageData.crop.x === 'number' && 
                        typeof imageData.crop.y === 'number' && 
                        typeof imageData.crop.width === 'number' && 
                        typeof imageData.crop.height === 'number' &&
                        imageData.crop.width > 0 && 
                        imageData.crop.height > 0;
        deleteBtn.style.display = hasCrop ? 'block' : 'none';
        console.log('🔘 Bouton Supprimer:', hasCrop ? 'affiché' : 'masqué', 'crop:', imageData.crop);
      } else {
        console.error('❌ Bouton imageCropDelete introuvable');
      }
    };
    
    img.onerror = function() {
      console.error('Erreur lors du chargement de l\'image:', imageSrc);
      alert('Impossible de charger l\'image pour le rognage');
    };
    
    // Charger l'image (utiliser l'URL originale convertie)
    img.src = imageSrc;
    
    // Afficher le modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  /**
   * Ferme le modal de rognage
   */
  function closeImageCropModal() {
    const modal = document.getElementById('imageCropModal');
    if (!modal) return;
    
    modal.style.display = 'none';
    document.body.style.overflow = '';
    
    // Nettoyer le canvas et retirer les event listeners
    const canvas = document.getElementById('imageCropCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Retirer les event listeners de rognage (drag and drop)
      if (canvas.cropMouseDownHandler) {
        canvas.removeEventListener('mousedown', canvas.cropMouseDownHandler);
        canvas.removeEventListener('mousemove', canvas.cropMouseMoveHandler);
        canvas.removeEventListener('mouseup', canvas.cropMouseUpHandler);
        canvas.cropMouseDownHandler = null;
        canvas.cropMouseMoveHandler = null;
        canvas.cropMouseUpHandler = null;
      }
      
      // Retirer les event listeners de redimensionnement
      if (canvas.cropResizeMouseDownHandler) {
        canvas.removeEventListener('mousedown', canvas.cropResizeMouseDownHandler);
        canvas.removeEventListener('mousemove', canvas.cropResizeMouseMoveHandler);
        canvas.removeEventListener('mouseup', canvas.cropResizeMouseUpHandler);
        if (canvas.cropResizeMouseOverHandler) {
          canvas.removeEventListener('mousemove', canvas.cropResizeMouseOverHandler);
        }
        canvas.cropResizeMouseDownHandler = null;
        canvas.cropResizeMouseMoveHandler = null;
        canvas.cropResizeMouseUpHandler = null;
        canvas.cropResizeMouseOverHandler = null;
      }
      
      // Réinitialiser le curseur
      canvas.style.cursor = 'default';
      
      // Nettoyer les données
      canvas.cropData = null;
      canvas.originalImage = null;
    }
    
    // Masquer le bouton "Supprimer"
    const deleteBtn = document.getElementById('imageCropDelete');
    if (deleteBtn) {
      deleteBtn.style.display = 'none';
    }
  }

  /**
   * Initialise le rectangle de rognage sur le canvas
   * @param {HTMLCanvasElement} canvas - Canvas
   * @param {Object} existingCrop - Rognage existant (optionnel)
   */
  function initCropRectangle(canvas, existingCrop) {
    // Initialiser les variables
    canvas.isDragging = false;
    canvas.isResizing = false;
    
    // Vérifier si un rognage valide existe (doit avoir x, y, width, height et des valeurs > 0)
    const hasValidCrop = existingCrop && 
                         typeof existingCrop.x === 'number' && 
                         typeof existingCrop.y === 'number' && 
                         typeof existingCrop.width === 'number' && 
                         typeof existingCrop.height === 'number' &&
                         existingCrop.width > 0 && 
                         existingCrop.height > 0;
    
    if (hasValidCrop) {
      console.log('✅ Rognage valide détecté:', existingCrop);
      // Si un rognage valide existe, l'afficher avec les poignées et activer le redimensionnement
      canvas.cropData = existingCrop;
      drawCropRectangle(canvas, existingCrop);
      // Activer les event listeners pour redimensionner et déplacer le rectangle existant
      enableCropResizeAndMove(canvas);
    } else {
      console.log('❌ Pas de rognage valide, activation du drag-and-drop');
      // Sinon, permettre le drag and drop pour créer un nouveau rectangle
      canvas.cropData = null;
      enableCropDragAndDrop(canvas);
    }
  }

  /**
   * Dessine le rectangle de rognage sur le canvas
   * @param {HTMLCanvasElement} canvas - Canvas
   * @param {Object} crop - Coordonnées du rognage
   */
  function drawCropRectangle(canvas, crop) {
    const ctx = canvas.getContext('2d');
    const scaleX = parseFloat(canvas.dataset.scaleX) || 1;
    const scaleY = parseFloat(canvas.dataset.scaleY) || 1;
    
    // Convertir les coordonnées originales en coordonnées canvas
    const x = (crop.x || 0) / scaleX;
    const y = (crop.y || 0) / scaleY;
    const width = (crop.width || canvas.width) / scaleX;
    const height = (crop.height || canvas.height) / scaleY;
    
    console.log('🎨 drawCropRectangle:', {
      cropOriginal: crop,
      cropCanvas: { x, y, width, height },
      scale: { scaleX, scaleY },
      canvasSize: { width: canvas.width, height: canvas.height }
    });
    
    // Utiliser l'image originale stockée
    const img = canvas.originalImage;
    if (!img) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Dessiner le rectangle de rognage
    ctx.strokeStyle = '#4b9ed8';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(x, y, width, height);
    
    // Dessiner l'overlay (zone sombre autour du rectangle)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(x, y, width, height);
    ctx.globalCompositeOperation = 'source-over';
    
    // Dessiner les poignées de redimensionnement
    drawCropHandles(ctx, x, y, width, height);
  }

  /**
   * Dessine les poignées de redimensionnement
   * @param {CanvasRenderingContext2D} ctx - Contexte du canvas
   * @param {number} x - Position X
   * @param {number} y - Position Y
   * @param {number} width - Largeur
   * @param {number} height - Hauteur
   */
  function drawCropHandles(ctx, x, y, width, height) {
    const handleSize = 8;
    const handles = [
      { name: 'nw', x: x, y: y }, // NW
      { name: 'n', x: x + width / 2, y: y }, // N
      { name: 'ne', x: x + width, y: y }, // NE
      { name: 'e', x: x + width, y: y + height / 2 }, // E
      { name: 'se', x: x + width, y: y + height }, // SE
      { name: 's', x: x + width / 2, y: y + height }, // S
      { name: 'sw', x: x, y: y + height }, // SW
      { name: 'w', x: x, y: y + height / 2 } // W
    ];
    
    console.log('🎨 Dessin des poignées:', handles.map(h => `${h.name}: (${h.x.toFixed(2)}, ${h.y.toFixed(2)})`));
    
    ctx.fillStyle = '#4b9ed8';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    
    handles.forEach(handle => {
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, handleSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  /**
   * Active le drag and drop pour créer un rectangle de rognage
   * @param {HTMLCanvasElement} canvas - Canvas
   */
  function enableCropDragAndDrop(canvas) {
    // Retirer les anciens event listeners s'ils existent
    if (canvas.cropMouseDownHandler) {
      canvas.removeEventListener('mousedown', canvas.cropMouseDownHandler);
      canvas.removeEventListener('mousemove', canvas.cropMouseMoveHandler);
      canvas.removeEventListener('mouseup', canvas.cropMouseUpHandler);
    }
    
    // S'assurer que le canvas est propre (seulement l'image, pas de rectangle)
    const ctx = canvas.getContext('2d');
    const img = canvas.originalImage;
    if (img) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    
    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    
    // Créer les handlers
    canvas.cropMouseDownHandler = (e) => {
      const rect = canvas.getBoundingClientRect();
      // Calculer le ratio entre la taille réelle du canvas et sa taille d'affichage
      const scaleXDisplay = canvas.width / rect.width;
      const scaleYDisplay = canvas.height / rect.height;
      
      // Coordonnées en pixels canvas (en tenant compte du ratio d'affichage)
      startX = (e.clientX - rect.left) * scaleXDisplay;
      startY = (e.clientY - rect.top) * scaleYDisplay;
      isDrawing = true;
    };
    
    canvas.cropMouseMoveHandler = (e) => {
      if (!isDrawing) return;
      
      const rect = canvas.getBoundingClientRect();
      // Calculer le ratio entre la taille réelle du canvas et sa taille d'affichage
      const scaleXDisplay = canvas.width / rect.width;
      const scaleYDisplay = canvas.height / rect.height;
      
      // Coordonnées en pixels canvas (en tenant compte du ratio d'affichage)
      currentX = (e.clientX - rect.left) * scaleXDisplay;
      currentY = (e.clientY - rect.top) * scaleYDisplay;
      
      // Redessiner avec le rectangle en cours
      redrawCanvasWithCrop(canvas, {
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: Math.abs(currentX - startX),
        height: Math.abs(currentY - startY)
      });
    };
    
    canvas.cropMouseUpHandler = (e) => {
      if (!isDrawing) return;
      isDrawing = false;
      
      const rect = canvas.getBoundingClientRect();
      // Calculer le ratio entre la taille réelle du canvas et sa taille d'affichage
      const scaleXDisplay = canvas.width / rect.width;
      const scaleYDisplay = canvas.height / rect.height;
      
      // Coordonnées en pixels canvas (en tenant compte du ratio d'affichage)
      currentX = (e.clientX - rect.left) * scaleXDisplay;
      currentY = (e.clientY - rect.top) * scaleYDisplay;
      
      // Sauvegarder le rectangle de rognage
      const crop = {
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: Math.abs(currentX - startX),
        height: Math.abs(currentY - startY)
      };
      
      // Convertir en coordonnées originales
      const scaleX = parseFloat(canvas.dataset.scaleX) || 1;
      const scaleY = parseFloat(canvas.dataset.scaleY) || 1;
      
      canvas.cropData = {
        x: crop.x * scaleX,
        y: crop.y * scaleY,
        width: crop.width * scaleX,
        height: crop.height * scaleY
      };
      
      // Afficher avec les poignées
      drawCropRectangle(canvas, canvas.cropData);
      
      // Retirer les handlers de drag-and-drop
      canvas.removeEventListener('mousedown', canvas.cropMouseDownHandler);
      canvas.removeEventListener('mousemove', canvas.cropMouseMoveHandler);
      canvas.removeEventListener('mouseup', canvas.cropMouseUpHandler);
      
      // Activer les handlers de redimensionnement pour utiliser les poignées
      enableCropResizeAndMove(canvas);
      
      // Afficher le bouton "Supprimer" maintenant qu'un rognage existe
      const deleteBtn = document.getElementById('imageCropDelete');
      if (deleteBtn) {
        deleteBtn.style.display = 'block';
        console.log('✅ Bouton Supprimer affiché après création du rectangle');
      } else {
        console.error('❌ Bouton imageCropDelete introuvable après création');
      }
    };
    
    // Ajouter les event listeners
    canvas.addEventListener('mousedown', canvas.cropMouseDownHandler);
    canvas.addEventListener('mousemove', canvas.cropMouseMoveHandler);
    canvas.addEventListener('mouseup', canvas.cropMouseUpHandler);
  }

  /**
   * Active le redimensionnement et le déplacement du rectangle de rognage existant
   * @param {HTMLCanvasElement} canvas - Canvas
   */
  function enableCropResizeAndMove(canvas) {
    // Retirer les anciens event listeners de redimensionnement s'ils existent
    if (canvas.cropResizeMouseDownHandler) {
      canvas.removeEventListener('mousedown', canvas.cropResizeMouseDownHandler);
      canvas.removeEventListener('mousemove', canvas.cropResizeMouseMoveHandler);
      canvas.removeEventListener('mouseup', canvas.cropResizeMouseUpHandler);
    }
    
    // Retirer aussi les event listeners de drag-and-drop s'ils existent
    if (canvas.cropMouseDownHandler) {
      canvas.removeEventListener('mousedown', canvas.cropMouseDownHandler);
      canvas.removeEventListener('mousemove', canvas.cropMouseMoveHandler);
      canvas.removeEventListener('mouseup', canvas.cropMouseUpHandler);
    }
    
    const scaleX = parseFloat(canvas.dataset.scaleX) || 1;
    const scaleY = parseFloat(canvas.dataset.scaleY) || 1;
    
    let isDragging = false;
    let isResizing = false;
    let resizeHandle = null;
    let startX = 0;
    let startY = 0;
    let startCrop = null;
    
    // Fonction pour obtenir la poignée la plus proche du point de clic
    function getHandleAt(x, y, crop) {
      const handleSize = 20; // Taille de détection augmentée pour faciliter le clic
      
      // S'assurer que x et y sont des nombres
      x = Number(x);
      y = Number(y);
      
      const handles = [
        { name: 'nw', x: Number(crop.x), y: Number(crop.y) },
        { name: 'n', x: Number(crop.x + crop.width / 2), y: Number(crop.y) },
        { name: 'ne', x: Number(crop.x + crop.width), y: Number(crop.y) },
        { name: 'e', x: Number(crop.x + crop.width), y: Number(crop.y + crop.height / 2) },
        { name: 'se', x: Number(crop.x + crop.width), y: Number(crop.y + crop.height) },
        { name: 's', x: Number(crop.x + crop.width / 2), y: Number(crop.y + crop.height) },
        { name: 'sw', x: Number(crop.x), y: Number(crop.y + crop.height) },
        { name: 'w', x: Number(crop.x), y: Number(crop.y + crop.height / 2) }
      ];
      
      let closestHandle = null;
      let closestDistance = Infinity;
      
      for (const handle of handles) {
        const dx = x - handle.x;
        const dy = y - handle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= handleSize && distance < closestDistance) {
          closestDistance = distance;
          closestHandle = handle.name;
        }
      }
      
      if (closestHandle) {
        console.log('🎯 Poignée trouvée:', closestHandle, 'distance:', closestDistance.toFixed(2));
      } else {
        console.log('❌ Aucune poignée trouvée.');
        console.log('Point de clic:', { x, y, typeX: typeof x, typeY: typeof y });
        handles.forEach(h => {
          const dx = x - h.x;
          const dy = y - h.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          console.log(`  ${h.name}: (${h.x.toFixed(2)}, ${h.y.toFixed(2)}) - distance: ${dist.toFixed(2)} - dans range: ${dist <= handleSize}`);
        });
        console.log('Taille de détection:', handleSize);
      }
      
      return closestHandle;
    }
    
    // Fonction pour vérifier si le clic est dans le rectangle
    function isPointInCrop(x, y, crop) {
      return x >= crop.x && x <= crop.x + crop.width &&
             y >= crop.y && y <= crop.y + crop.height;
    }
    
    canvas.cropResizeMouseDownHandler = (e) => {
      const rect = canvas.getBoundingClientRect();
      // Calculer le ratio entre la taille réelle du canvas et sa taille d'affichage
      const scaleXDisplay = canvas.width / rect.width;
      const scaleYDisplay = canvas.height / rect.height;
      
      // Coordonnées en pixels canvas (en tenant compte du ratio d'affichage)
      const mouseX = (e.clientX - rect.left) * scaleXDisplay;
      const mouseY = (e.clientY - rect.top) * scaleYDisplay;
      
      console.log('🖱️ MouseDown sur canvas:', { mouseX, mouseY, hasCropData: !!canvas.cropData });
      
      if (!canvas.cropData) {
        console.log('❌ Pas de cropData');
        return;
      }
      
      // Convertir les coordonnées du crop en coordonnées canvas
      // Utiliser exactement la même formule que dans drawCropRectangle
      const cropCanvas = {
        x: Number((canvas.cropData.x || 0) / scaleX),
        y: Number((canvas.cropData.y || 0) / scaleY),
        width: Number((canvas.cropData.width || canvas.width) / scaleX),
        height: Number((canvas.cropData.height || canvas.height) / scaleY)
      };
      
      console.log('📐 Crop canvas (détection):', cropCanvas);
      console.log('📐 Crop data original:', canvas.cropData);
      console.log('📐 Scale:', { scaleX, scaleY });
      console.log('📐 Canvas size:', { width: canvas.width, height: canvas.height });
      
      // Vérifier si on clique sur une poignée
      const handle = getHandleAt(mouseX, mouseY, cropCanvas);
      console.log('🔧 Handle détecté:', handle);
      
      if (handle) {
        console.log('✅ Démarrage redimensionnement avec poignée:', handle);
        isResizing = true;
        resizeHandle = handle;
        startX = mouseX;
        startY = mouseY;
        startCrop = { ...cropCanvas };
        e.preventDefault();
        e.stopPropagation();
      } else if (isPointInCrop(mouseX, mouseY, cropCanvas)) {
        console.log('✅ Démarrage déplacement');
        // Clic dans le rectangle : déplacer
        isDragging = true;
        startX = mouseX;
        startY = mouseY;
        startCrop = { ...cropCanvas };
        e.preventDefault();
        e.stopPropagation();
      } else {
        console.log('❌ Clic en dehors du rectangle');
      }
    };
    
    canvas.cropResizeMouseMoveHandler = (e) => {
      if (!isDragging && !isResizing) return;
      if (!canvas.cropData || !startCrop) return;
      
      const rect = canvas.getBoundingClientRect();
      // Calculer le ratio entre la taille réelle du canvas et sa taille d'affichage
      const scaleXDisplay = canvas.width / rect.width;
      const scaleYDisplay = canvas.height / rect.height;
      
      // Coordonnées en pixels canvas (en tenant compte du ratio d'affichage)
      const currentX = (e.clientX - rect.left) * scaleXDisplay;
      const currentY = (e.clientY - rect.top) * scaleYDisplay;
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      
      let newCrop = { ...startCrop };
      
      if (isResizing && resizeHandle) {
        // Redimensionner selon la poignée
        switch (resizeHandle) {
          case 'nw':
            newCrop.x += deltaX;
            newCrop.y += deltaY;
            newCrop.width -= deltaX;
            newCrop.height -= deltaY;
            break;
          case 'n':
            newCrop.y += deltaY;
            newCrop.height -= deltaY;
            break;
          case 'ne':
            newCrop.y += deltaY;
            newCrop.width += deltaX;
            newCrop.height -= deltaY;
            break;
          case 'e':
            newCrop.width += deltaX;
            break;
          case 'se':
            newCrop.width += deltaX;
            newCrop.height += deltaY;
            break;
          case 's':
            newCrop.height += deltaY;
            break;
          case 'sw':
            newCrop.x += deltaX;
            newCrop.width -= deltaX;
            newCrop.height += deltaY;
            break;
          case 'w':
            newCrop.x += deltaX;
            newCrop.width -= deltaX;
            break;
        }
        
        // Limiter les dimensions minimales
        if (newCrop.width < 10) {
          newCrop.width = 10;
          if (resizeHandle.includes('w')) newCrop.x = startCrop.x + startCrop.width - 10;
        }
        if (newCrop.height < 10) {
          newCrop.height = 10;
          if (resizeHandle.includes('n')) newCrop.y = startCrop.y + startCrop.height - 10;
        }
        
        // Limiter aux bords du canvas
        if (newCrop.x < 0) {
          newCrop.width += newCrop.x;
          newCrop.x = 0;
        }
        if (newCrop.y < 0) {
          newCrop.height += newCrop.y;
          newCrop.y = 0;
        }
        if (newCrop.x + newCrop.width > canvas.width) {
          newCrop.width = canvas.width - newCrop.x;
        }
        if (newCrop.y + newCrop.height > canvas.height) {
          newCrop.height = canvas.height - newCrop.y;
        }
      } else if (isDragging) {
        // Déplacer le rectangle
        newCrop.x = startCrop.x + deltaX;
        newCrop.y = startCrop.y + deltaY;
        
        // Limiter aux bords du canvas
        if (newCrop.x < 0) newCrop.x = 0;
        if (newCrop.y < 0) newCrop.y = 0;
        if (newCrop.x + newCrop.width > canvas.width) {
          newCrop.x = canvas.width - newCrop.width;
        }
        if (newCrop.y + newCrop.height > canvas.height) {
          newCrop.y = canvas.height - newCrop.height;
        }
      }
      
      // Convertir en coordonnées originales et mettre à jour
      canvas.cropData = {
        x: newCrop.x * scaleX,
        y: newCrop.y * scaleY,
        width: newCrop.width * scaleX,
        height: newCrop.height * scaleY
      };
      
      // Redessiner
      drawCropRectangle(canvas, canvas.cropData);
    };
    
    canvas.cropResizeMouseUpHandler = () => {
      isDragging = false;
      isResizing = false;
      resizeHandle = null;
      startCrop = null;
    };
    
    // Gestionnaire pour changer le curseur au survol
    canvas.cropResizeMouseOverHandler = (e) => {
      // Ne pas changer le curseur si on est en train de redimensionner ou déplacer
      if (isDragging || isResizing || startCrop) {
        return;
      }
      
      if (!canvas.cropData) {
        canvas.style.cursor = 'default';
        return;
      }
      
      const rect = canvas.getBoundingClientRect();
      // Calculer le ratio entre la taille réelle du canvas et sa taille d'affichage
      const scaleXDisplay = canvas.width / rect.width;
      const scaleYDisplay = canvas.height / rect.height;
      
      // Coordonnées en pixels canvas (en tenant compte du ratio d'affichage)
      const mouseX = (e.clientX - rect.left) * scaleXDisplay;
      const mouseY = (e.clientY - rect.top) * scaleYDisplay;
      
      const cropCanvas = {
        x: Number(canvas.cropData.x / scaleX),
        y: Number(canvas.cropData.y / scaleY),
        width: Number(canvas.cropData.width / scaleX),
        height: Number(canvas.cropData.height / scaleY)
      };
      
      const handle = getHandleAt(mouseX, mouseY, cropCanvas);
      if (handle) {
        // Changer le curseur selon la poignée
        const cursors = {
          'nw': 'nw-resize', 'n': 'n-resize', 'ne': 'ne-resize',
          'e': 'e-resize', 'se': 'se-resize', 's': 's-resize',
          'sw': 'sw-resize', 'w': 'w-resize'
        };
        canvas.style.cursor = cursors[handle] || 'move';
      } else if (isPointInCrop(mouseX, mouseY, cropCanvas)) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'default';
      }
    };
    
    // Ajouter les event listeners
    canvas.addEventListener('mousedown', canvas.cropResizeMouseDownHandler);
    canvas.addEventListener('mousemove', canvas.cropResizeMouseMoveHandler);
    canvas.addEventListener('mouseup', canvas.cropResizeMouseUpHandler);
    canvas.addEventListener('mousemove', canvas.cropResizeMouseOverHandler);
    
    // S'assurer que le canvas peut recevoir les événements
    canvas.style.pointerEvents = 'auto';
    canvas.style.cursor = 'default';
    
    console.log('✅ Handlers de redimensionnement attachés au canvas');
  }

  /**
   * Redessine le canvas avec un rectangle de rognage
   * @param {HTMLCanvasElement} canvas - Canvas
   * @param {Object} crop - Coordonnées du rectangle
   */
  function redrawCanvasWithCrop(canvas, crop) {
    const ctx = canvas.getContext('2d');
    const img = canvas.originalImage;
    if (!img) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Dessiner l'overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(crop.x, crop.y, crop.width, crop.height);
    ctx.globalCompositeOperation = 'source-over';
    
    // Dessiner le rectangle
    ctx.strokeStyle = '#4b9ed8';
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
  }

  /**
   * Applique le rognage à l'image
   */
  function applyImageCrop() {
    const modal = document.getElementById('imageCropModal');
    const canvas = document.getElementById('imageCropCanvas');
    if (!modal || !canvas) return;
    
    const imageId = modal.dataset.imageElement;
    const imgElement = document.querySelector(`[data-image-id="${imageId}"]`);
    if (!imgElement) return;
    
    // Si aucun rognage n'est actif, juste fermer le modal
    if (!canvas.cropData) {
      closeImageCropModal();
      return;
    }
    
    // Créer un nouveau canvas pour le rognage
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');
    const crop = canvas.cropData;
    
    // Définir la taille du canvas de rognage
    cropCanvas.width = crop.width;
    cropCanvas.height = crop.height;
    
    // Charger l'image originale
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      // Dessiner la partie rognée
      cropCtx.drawImage(
        img,
        crop.x, crop.y, crop.width, crop.height, // Source
        0, 0, crop.width, crop.height // Destination
      );
      
      // Convertir en data URL et mettre à jour l'image
      const dataURL = cropCanvas.toDataURL('image/png');
      imgElement.src = dataURL;
      
      // Sauvegarder le rognage dans imageData
      const imageData = findImageDataFromElement(imgElement);
      if (imageData) {
        imageData.crop = crop;
        imageData.croppedSrc = dataURL;
      }
      
      // Fermer le modal
      closeImageCropModal();
    };
    
    img.onerror = function() {
      console.error('Erreur lors du chargement de l\'image:', modal.dataset.imageSrc);
      alert('Erreur lors de l\'application du rognage. Vérifiez la console pour plus de détails.');
    };
    
    // L'URL est déjà convertie en URL absolue dans openImageCropModal
    img.src = modal.dataset.imageSrc;
  }

  /**
   * Réinitialise le rognage
   */
  function resetImageCrop() {
    const modal = document.getElementById('imageCropModal');
    const canvas = document.getElementById('imageCropCanvas');
    if (!modal || !canvas) return;
    
    const imageId = modal.dataset.imageElement;
    const imgElement = document.querySelector(`[data-image-id="${imageId}"]`);
    if (!imgElement) return;
    
    // Réinitialiser le rognage
    canvas.cropData = null;
    
    // Utiliser l'image originale stockée
    const img = canvas.originalImage;
    if (img) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Réactiver le drag and drop
      enableCropDragAndDrop(canvas);
      
      // Masquer le bouton "Supprimer" car le rognage est réinitialisé
      const deleteBtn = document.getElementById('imageCropDelete');
      if (deleteBtn) {
        deleteBtn.style.display = 'none';
      }
    }
  }

  /**
   * Supprime complètement le rognage (dans le modal et dans imageData)
   */
  function deleteImageCrop() {
    const modal = document.getElementById('imageCropModal');
    const canvas = document.getElementById('imageCropCanvas');
    if (!modal || !canvas) return;
    
    const imageId = modal.dataset.imageElement;
    const imgElement = document.querySelector(`[data-image-id="${imageId}"]`);
    if (!imgElement) return;
    
    // Récupérer l'imageData
    const imageData = findImageDataFromElement(imgElement);
    if (!imageData) return;
    
    // Supprimer le rognage de imageData
    delete imageData.crop;
    delete imageData.croppedSrc;
    
    // Remettre l'image à l'originale - construire l'URL complète comme dans openImageCropModal
    let originalSrc = imageData.originalSrc || imageData.src;
    if (!originalSrc) {
      console.error('Impossible de trouver l\'URL originale de l\'image');
      return;
    }
    
    // Construire l'URL complète (même logique que dans openImageCropModal)
    let imageSrc = originalSrc;
    
    // Si c'est déjà une URL complète (http/https/data), l'utiliser telle quelle
    if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://') || imageSrc.startsWith('data:')) {
      // URL complète, utiliser telle quelle
    } else if (imageData.name || imageData.tempImageId) {
      // C'est un nom d'image ou un tempImageId, construire l'URL via l'API
      if (imageData.tempImageId) {
        // Image temporaire
        imageSrc = buildTempImageUrl(imageData.tempImageId);
      } else if (imageData.name) {
        // Image sauvegardée
        imageSrc = buildDocumentImageUrl(imageData.name);
      } else {
        // Essayer avec originalSrc comme nom d'image
        imageSrc = buildDocumentImageUrl(originalSrc);
      }
    } else {
      // URL relative, la convertir en URL absolue
      try {
        if (imageSrc.startsWith('/')) {
          imageSrc = new URL(imageSrc, window.location.origin).href;
        } else {
          imageSrc = new URL(imageSrc, window.location.href).href;
        }
      } catch (e) {
        console.error('Erreur lors de la conversion de l\'URL:', e, originalSrc);
        imageSrc = new URL(imageSrc, window.location.href).href;
      }
    }
    
    // Remettre l'image à l'originale avec l'URL complète
    imgElement.src = imageSrc;
    
    // Réinitialiser le canvas dans le modal
    canvas.cropData = null;
    const img = canvas.originalImage;
    if (img) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Réactiver le drag and drop
      enableCropDragAndDrop(canvas);
    }
    
    // Masquer le bouton "Supprimer"
    const deleteBtn = document.getElementById('imageCropDelete');
    if (deleteBtn) {
      deleteBtn.style.display = 'none';
    }
  }

  function clearSelectedElement() {
    if (!selectedElement) return;
    if (selectedElement.classList.contains('element-selected')) {
      selectedElement.classList.remove('element-selected');
    }
    removeResizeHandles(selectedElement);
    removeLockButtons(selectedElement);
    selectedElement = null;
    const propertiesArea = document.querySelector('[data-properties-area]');
    if (propertiesArea) {
      propertiesArea.innerHTML = '<p class="text-muted">Sélectionnez une section</p>';
    }
    const cardPropertiesArea = document.querySelector('[data-card-properties]');
    if (cardPropertiesArea) {
      cardPropertiesArea.innerHTML = '<p class="text-muted">Sélectionnez une section</p>';
    }
  }

  /**
   * Gère le clic sur un élément du contenu
   * @param {Event} e - Événement de clic
   */
  function handleContentClick(e) {
    if (typeof variableManager.clearSelection === 'function') {
      variableManager.clearSelection();
    }

    // Ignorer les clics sur les éléments interactifs (liens, boutons, etc.)
    if (e.target.closest('a, button, .toc-entry')) {
      return;
    }

    // Récupérer la zone de contenu
    const contentArea = document.querySelector('[data-content-area]');
    if (!contentArea) return;

    // Trouver l'élément cliqué (paragraphe, titre, image)
    let targetElement = null;
    
    // Si on clique sur un wrapper d'image ou un conteneur d'image, sélectionner l'image
    if (e.target.classList.contains('image-wrapper') || 
        e.target.classList.contains('resize-handle') ||
        e.target.classList.contains('resize-handle-container') ||
        e.target.classList.contains('image-lock-container') ||
        e.target.classList.contains('image-lock-button')) {
      const imageWrapper = e.target.closest('.image-wrapper');
      if (imageWrapper) {
        const img = imageWrapper.querySelector('img');
        if (img) {
          targetElement = img;
        }
      }
    }
    
    if (!targetElement && (e.target.tagName === 'H1' || e.target.tagName === 'H2' || 
        e.target.tagName === 'H3' || e.target.tagName === 'H4' || 
        e.target.tagName === 'H5' || e.target.tagName === 'H6' ||
        e.target.tagName === 'P' || e.target.tagName === 'IMG')) {
      targetElement = e.target;
    } else if (!targetElement) {
      targetElement = e.target.closest('h1, h2, h3, h4, h5, h6, p, img');
      if (targetElement && targetElement.tagName === 'DIV') {
        const img = targetElement.querySelector('img');
        if (img) {
          targetElement = img;
        }
      }
    }

    if (!targetElement) {
      clearSelectedElement();
      return;
    }

    // Si on clique sur un titre de section, afficher les propriétés de la section
    if (targetElement.classList.contains('section-title') && targetElement.dataset.sectionId) {
      const sectionId = targetElement.dataset.sectionId;
      const section = findSectionByIdInTree(sectionId, sectionsTree);
      if (section) {
        // Vérifier quel onglet est actif
        const activeTab = document.querySelector('[data-properties-tab].is-active');
        const activeTabName = activeTab ? activeTab.dataset.propertiesTab : null;
        
        // Afficher les propriétés selon l'onglet actif
        if (activeTabName === 'properties') {
          displaySectionProperties(section.section);
        } else if (activeTabName === 'options') {
          // Recharger l'onglet Options pour afficher les propriétés de la section sélectionnée
          loadOptionsListSidebar();
        }
        
        // Mettre en surbrillance la section
        const sectionElement = contentArea.querySelector(`.section[data-section-id="${sectionId}"]`);
        if (sectionElement) {
          contentArea.querySelectorAll('.section').forEach(s => s.classList.remove('section-selected'));
          sectionElement.classList.add('section-selected');
        }
        return;
      }
    }

    // Ne jamais ajouter la sélection aux éléments éditables
    if (targetElement.classList.contains('editable-text')) {
      displayElementProperties(targetElement);
      return;
    }

    // Retirer TOUTES les sélections et poignées existantes avant de sélectionner le nouvel élément
    contentArea.querySelectorAll('.element-selected').forEach(el => {
      el.classList.remove('element-selected');
      if (el.tagName === 'IMG') {
        removeResizeHandles(el);
        removeLockButtons(el);
      }
    });
    
    // Aussi retirer les poignées de l'élément stocké dans selectedElement si c'est une image
    if (selectedElement && selectedElement.tagName === 'IMG') {
      removeResizeHandles(selectedElement);
      removeLockButtons(selectedElement);
    }
    
    // Retirer toutes les poignées de toutes les images dans le contenu (sécurité)
    contentArea.querySelectorAll('img').forEach(img => {
      if (img !== targetElement) {
        removeResizeHandles(img);
        removeLockButtons(img);
        img.classList.remove('element-selected');
      }
    });

    displayElementProperties(targetElement);
    targetElement.classList.add('element-selected');
    
    if (targetElement.tagName === 'IMG') {
      addResizeHandles(targetElement);
      addLockButtons(targetElement);
    }
  }

  function initGlobalFocusReset() {
    document.addEventListener('click', handleGlobalFocusReset, true);
  }

  function handleGlobalFocusReset(event) {
    const target = event.target;

    const insideVariableUI =
      target.closest('[data-properties-panel="variables"]') ||
      target.closest('[data-variable-tabs]');
    if (!insideVariableUI && typeof variableManager.clearSelection === 'function') {
      variableManager.clearSelection();
    }

    const insideContent = target.closest('[data-content-area]');
    const insidePropertiesArea =
      target.closest('[data-properties-area]') || target.closest('[data-card-properties]');
    const insideImageControls =
      target.closest('.resize-handle') ||
      target.closest('.resize-handle-container') ||
      target.closest('.image-lock-container') ||
      target.closest('.image-lock-button');
    const isPropertiesTab = target.closest('[data-properties-tab]');
    const isPropertiesTabContainer = target.closest('[data-properties-tabs]') && !isPropertiesTab;

    // Si on clique sur un onglet de propriétés (mais pas sur le conteneur), désélectionner
    if (isPropertiesTab) {
      const tabTarget = isPropertiesTab.dataset.propertiesTab;
      if (tabTarget !== 'properties') {
        clearSelectedElement();
      }
      return; // Laisser le gestionnaire d'événement de l'onglet gérer le reste
    }

    // Si on clique en dehors du contenu ET des propriétés ET des contrôles d'image ET des onglets, désélectionner
    // On laisse handleContentClick gérer les clics dans le contenu
    if (!insideContent && !insidePropertiesArea && !insideImageControls && !isPropertiesTabContainer) {
      clearSelectedElement();
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
   * Ajoute les handles de redimensionnement à une image
   * @param {HTMLElement} imgElement - Élément img
   */
  function addResizeHandles(imgElement) {
    if (!imgElement || imgElement.tagName !== 'IMG') return;
    
    // Trouver le wrapper de l'image
    const imageWrapper = imgElement.parentElement;
    if (!imageWrapper || !imageWrapper.classList.contains('image-wrapper')) {
      return;
    }
    
    // Vérifier si les handles existent déjà
    if (imageWrapper.querySelector('.resize-handle')) {
      return;
    }
    
    // Créer un conteneur pour les handles
    const handleContainer = document.createElement('div');
    handleContainer.className = 'resize-handle-container';
    imageWrapper.appendChild(handleContainer);
    
    // Créer les handles (coins et bords)
    const handles = [
      { class: 'resize-handle resize-handle-nw', cursor: 'nw-resize' }, // Coin haut-gauche
      { class: 'resize-handle resize-handle-n', cursor: 'n-resize' },   // Bord haut
      { class: 'resize-handle resize-handle-ne', cursor: 'ne-resize' }, // Coin haut-droite
      { class: 'resize-handle resize-handle-e', cursor: 'e-resize' },   // Bord droit
      { class: 'resize-handle resize-handle-se', cursor: 'se-resize' }, // Coin bas-droite
      { class: 'resize-handle resize-handle-s', cursor: 's-resize' },    // Bord bas
      { class: 'resize-handle resize-handle-sw', cursor: 'sw-resize' }, // Coin bas-gauche
      { class: 'resize-handle resize-handle-w', cursor: 'w-resize' }     // Bord gauche
    ];
    
    handles.forEach(handle => {
      const handleEl = document.createElement('div');
      handleEl.className = handle.class;
      handleEl.style.cursor = handle.cursor;
      handleContainer.appendChild(handleEl);
      
      // Attacher les événements de drag
      handleEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startResize(e, imgElement, handle.class);
      });
    });
  }

  /**
   * Retire les handles de redimensionnement
   * @param {HTMLElement} element - Élément
   */
  function removeResizeHandles(element) {
    if (!element) return;
    // Chercher dans le wrapper de l'image
    const imageWrapper = element.tagName === 'IMG' 
      ? element.parentElement 
      : element.querySelector('.image-wrapper') || element;
    const container = imageWrapper?.querySelector('.resize-handle-container');
    if (container) {
      container.remove();
    }
  }

  /**
   * Démarre le redimensionnement d'une image
   * @param {Event} e - Événement mousedown
   * @param {HTMLElement} imgElement - Élément img
   * @param {string} handleClass - Classe du handle utilisé
   */
  function startResize(e, imgElement, handleClass) {
    const imageData = findImageDataFromElement(imgElement);
    if (!imageData) return;
    
    // Lire la rotation actuelle pour savoir si on doit inverser les dimensions
    let currentRotation = 0;
    if (imageData.rotation !== undefined && imageData.rotation !== null) {
      // Gérer le cas où rotation est une chaîne ("90deg") ou un nombre (90)
      let rotationValue;
      if (typeof imageData.rotation === 'string') {
        rotationValue = imageData.rotation.replace('deg', '').trim();
      } else {
        rotationValue = imageData.rotation;
      }
      const numericValue = parseFloat(rotationValue);
      if (!isNaN(numericValue)) {
        currentRotation = numericValue;
      }
    }
    const normalizedRotation = ((currentRotation % 360) + 360) % 360;
    const isRotated90or270 = normalizedRotation === 90 || normalizedRotation === 270;
    
    // Vérifier les verrouillages
    const widthLocked = imageData?.locked?.width ?? false;
    const heightLocked = imageData?.locked?.height ?? true;
    
    // Déterminer quelles dimensions peuvent être modifiées selon le handle
    const canResizeWidth = !widthLocked && (
      handleClass.includes('-e') || handleClass.includes('-w') || 
      handleClass.includes('-ne') || handleClass.includes('-se') || 
      handleClass.includes('-nw') || handleClass.includes('-sw')
    );
    const canResizeHeight = !heightLocked && (
      handleClass.includes('-n') || handleClass.includes('-s') || 
      handleClass.includes('-ne') || handleClass.includes('-se') || 
      handleClass.includes('-nw') || handleClass.includes('-sw')
    );
    
    if (!canResizeWidth && !canResizeHeight) {
      return; // Rien à redimensionner
    }
    
    const startX = e.clientX;
    const startY = e.clientY;
    
    // Utiliser les dimensions logiques du style (pas offsetWidth/offsetHeight qui donnent les dimensions visuelles)
    const startWidth = parseFloat(imgElement.style.width) || imgElement.naturalWidth || 0;
    const startHeight = parseFloat(imgElement.style.height) || imgElement.naturalHeight || 0;
    
    // Pour le positionnement, utiliser offsetLeft/offsetTop
    const startLeft = imgElement.offsetLeft;
    const startTop = imgElement.offsetTop;
    
    // Déterminer la direction du redimensionnement
    const isLeft = handleClass.includes('-w') || handleClass.includes('-nw') || handleClass.includes('-sw');
    const isTop = handleClass.includes('-n') || handleClass.includes('-nw') || handleClass.includes('-ne');
    
    function handleMouseMove(e) {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;
      
      // Si rotation 90/270°, inverser les dimensions à modifier
      // Redimensionner visuellement la largeur (deltaX) = modifier la hauteur logique
      // Redimensionner visuellement la hauteur (deltaY) = modifier la largeur logique
      if (isRotated90or270) {
        if (canResizeWidth) {
          // On redimensionne visuellement la largeur, donc on modifie la hauteur logique
          if (isLeft) {
            newHeight = startHeight - deltaX;
            newLeft = startLeft + deltaX;
          } else {
            newHeight = startHeight + deltaX;
          }
          if (newHeight < 20) newHeight = 20;
        }
        if (canResizeHeight) {
          // On redimensionne visuellement la hauteur, donc on modifie la largeur logique
          if (isTop) {
            newWidth = startWidth - deltaY;
            newTop = startTop + deltaY;
          } else {
            newWidth = startWidth + deltaY;
          }
          if (newWidth < 20) newWidth = 20;
        }
      } else {
        // Pas de rotation : comportement normal
        if (canResizeWidth) {
          if (isLeft) {
            newWidth = startWidth - deltaX;
            newLeft = startLeft + deltaX;
          } else {
            newWidth = startWidth + deltaX;
          }
          if (newWidth < 20) newWidth = 20;
        }
        if (canResizeHeight) {
          if (isTop) {
            newHeight = startHeight - deltaY;
            newTop = startTop + deltaY;
          } else {
            newHeight = startHeight + deltaY;
          }
          if (newHeight < 20) newHeight = 20;
        }
      }
      
      // Appliquer les nouvelles dimensions à l'image (dimensions logiques)
      imgElement.style.width = `${newWidth}px`;
      imgElement.style.height = `${newHeight}px`;
      if (isLeft) {
        imgElement.style.marginLeft = `${newLeft - startLeft}px`;
      }
      if (isTop) {
        imgElement.style.marginTop = `${newTop - startTop}px`;
      }
      
      // Mettre à jour le wrapper avec les mêmes dimensions logiques (sans contraintes min/max pour permettre à l'image de dépasser)
      const wrapper = imgElement.closest('.image-wrapper');
      if (wrapper) {
        wrapper.style.setProperty('width', `${newWidth}px`, 'important');
        wrapper.style.setProperty('height', `${newHeight}px`, 'important');
      }
    }
    
    function handleMouseUp(e) {
      // Sauvegarder les dimensions finales (dimensions logiques du style)
      const finalWidth = parseFloat(imgElement.style.width) || 0;
      const finalHeight = parseFloat(imgElement.style.height) || 0;
      
      if (imageData) {
        if (canResizeWidth) {
          imageData.width = finalWidth;
        }
        if (canResizeHeight) {
          imageData.height = finalHeight;
        }
      }
      
      // Mettre à jour les propriétés affichées
      if (selectedElement === imgElement) {
        displayElementProperties(imgElement);
      }
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  /**
   * Ajoute les boutons de verrouillage sur une image
   * @param {HTMLElement} imgElement - Élément img
   */
  function addLockButtons(imgElement) {
    if (!imgElement || imgElement.tagName !== 'IMG') return;
    
    // Trouver le wrapper de l'image
    const imageWrapper = imgElement.parentElement;
    if (!imageWrapper || !imageWrapper.classList.contains('image-wrapper')) {
      return;
    }
    
    // Vérifier si les boutons existent déjà
    if (imageWrapper.querySelector('.image-lock-button')) {
      return;
    }
    
    const imageData = findImageDataFromElement(imgElement);
    const widthLocked = imageData?.locked?.width ?? false;
    const heightLocked = imageData?.locked?.height ?? true;
    
    // Créer un conteneur pour les boutons de verrouillage
    const lockContainer = document.createElement('div');
    lockContainer.className = 'image-lock-container';
    imageWrapper.appendChild(lockContainer);
    
    // Bouton pour la largeur (en haut au milieu)
    const widthLockBtn = document.createElement('button');
    widthLockBtn.className = `image-lock-button image-lock-width ${widthLocked ? 'is-locked' : ''}`;
    widthLockBtn.title = widthLocked ? 'Déverrouiller la largeur' : 'Verrouiller la largeur';
    widthLockBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${widthLocked ? `
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        ` : `
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 5.5-4.945M12.5 2.055A5 5 0 0 1 17 7v4"></path>
          <line x1="12" y1="16" x2="12" y2="19"></line>
        `}
      </svg>
    `;
    widthLockBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Lire l'état actuel avant de basculer
      const currentImageData = findImageDataFromElement(imgElement);
      const currentlyLocked = currentImageData?.locked?.width ?? false;
      const stateChanged = toggleImageLock('width', !currentlyLocked, imgElement);
      if (stateChanged) {
        widthLockBtn.classList.toggle('is-locked');
        widthLockBtn.title = !currentlyLocked ? 'Déverrouiller la largeur' : 'Verrouiller la largeur';
      }
    });
    lockContainer.appendChild(widthLockBtn);
    
    // Bouton pour la hauteur (à droite au milieu)
    const heightLockBtn = document.createElement('button');
    heightLockBtn.className = `image-lock-button image-lock-height ${heightLocked ? 'is-locked' : ''}`;
    heightLockBtn.title = heightLocked ? 'Déverrouiller la hauteur' : 'Verrouiller la hauteur';
    heightLockBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${heightLocked ? `
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        ` : `
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 5.5-4.945M12.5 2.055A5 5 0 0 1 17 7v4"></path>
          <line x1="12" y1="16" x2="12" y2="19"></line>
        `}
      </svg>
    `;
    heightLockBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Lire l'état actuel avant de basculer
      const currentImageData = findImageDataFromElement(imgElement);
      const currentlyLocked = currentImageData?.locked?.height ?? true;
      const stateChanged = toggleImageLock('height', !currentlyLocked, imgElement);
      if (stateChanged) {
        heightLockBtn.classList.toggle('is-locked');
        heightLockBtn.title = !currentlyLocked ? 'Déverrouiller la hauteur' : 'Verrouiller la hauteur';
      }
    });
    lockContainer.appendChild(heightLockBtn);
  }

  /**
   * Retire les boutons de verrouillage
   * @param {HTMLElement} element - Élément
   */
  function removeLockButtons(element) {
    if (!element) return;
    // Chercher dans le wrapper de l'image
    const imageWrapper = element.tagName === 'IMG' 
      ? element.parentElement 
      : element.querySelector('.image-wrapper') || element;
    const container = imageWrapper?.querySelector('.image-lock-container');
    if (container) {
      container.remove();
    }
  }

  /**
   * Active/désactive le verrouillage d'une propriété d'image
   * @param {string} lockType - Type de verrouillage ('width' ou 'height')
   * @param {boolean} locked - Si true, verrouiller, sinon déverrouiller
   * @param {HTMLElement} imgElement - Élément img (optionnel, utilise selectedElement si absent)
   */
  function toggleImageLock(lockType, locked, imgElement = null) {
    const targetImg = imgElement || selectedElement;
    if (!targetImg || targetImg.tagName !== 'IMG') return false;
    
    const imageData = findImageDataFromElement(targetImg);
    if (!imageData) return false;
    
    // Initialiser locked si absent
    if (!imageData.locked) {
      imageData.locked = { width: false, height: true }; // Par défaut : hauteur verrouillée
    }
    
    const oppositeType = lockType === 'width' ? 'height' : 'width';
    if (locked && imageData.locked[oppositeType]) {
      alert('Impossible de verrouiller la largeur et la hauteur en même temps.');
      return false;
    }
    
    if (imageData.locked[lockType] === locked) {
      return false;
    }
    
    // Mettre à jour l'état de verrouillage
    imageData.locked[lockType] = locked;
    imageData.locked.userOverride = true;
    
    // Mettre à jour les boutons de verrouillage sur l'image
    const imageWrapper = targetImg.parentElement;
    if (imageWrapper && imageWrapper.classList.contains('image-wrapper')) {
      const lockButton = imageWrapper.querySelector(`.image-lock-${lockType}`);
      if (lockButton) {
        lockButton.classList.toggle('is-locked', locked);
        lockButton.title = locked 
          ? `Déverrouiller la ${lockType === 'width' ? 'largeur' : 'hauteur'}` 
          : `Verrouiller la ${lockType === 'width' ? 'largeur' : 'hauteur'}`;
        // Mettre à jour l'icône SVG
        const svg = lockButton.querySelector('svg');
        if (svg) {
          svg.innerHTML = locked ? `
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          ` : `
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 5.5-4.945M12.5 2.055A5 5 0 0 1 17 7v4"></path>
            <line x1="12" y1="16" x2="12" y2="19"></line>
          `;
        }
      }
    }
    
    // Mettre à jour les propriétés affichées
    if (selectedElement === targetImg) {
      displayElementProperties(targetImg);
    }
    
    return true;
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
   * Charge et rend les documents réintégrés
   */
  async function loadIntegratedDocuments() {
    const placeholders = document.querySelectorAll('.integrated-document-placeholder');
    
    for (const placeholder of placeholders) {
      const docId = placeholder.dataset.documentId;
      const sectionId = placeholder.dataset.sectionId;
      
      if (!docId) continue;

      try {
        // Trouver la section dans sectionsTree pour récupérer les infos (canvas, variables)
        const section = findSectionByIdInTree(sectionId, sectionsTree);
        if (!section) continue;

        const sectionData = section.section || section;
        const inheritedCanvas = sectionData.canvas || documentJson?.canvas || null;
        const inheritedVariables = sectionData.inheritedVariables || [];
        const customVariables = sectionData.customVariables || {};

        // Charger le document réintégré
        const response = await fetch(`${apiBase}/agent-documentaire/document/${docId}`);
        const payload = await response.json();

        if (!payload.success || !payload.data) {
          placeholder.innerHTML = '<p class="text-danger">Erreur : Document non trouvé</p>';
          continue;
        }

        const integratedDoc = payload.data;
        const integratedSections = Array.isArray(integratedDoc.json_content?.sections) 
          ? integratedDoc.json_content.sections 
          : [];

        // Rendre les sections du document réintégré
        let html = '';
        integratedSections.forEach(integratedSection => {
          // Appliquer le canevas hérité si nécessaire
          if (inheritedCanvas && integratedDoc.json_content) {
            // Fusionner le canevas (hérité en priorité)
            integratedDoc.json_content.canvas = {
              ...integratedDoc.json_content.canvas,
              ...inheritedCanvas
            };
          }
          
          html += generateSectionHTML(integratedSection, integratedSection.level || 1);
        });

        placeholder.innerHTML = html || '<p class="text-muted">Document vide</p>';

        // Réappliquer les événements sur le nouveau contenu
        attachContentClickEvents();
        attachTextEditEvents();
        processImageTransparency();
        adjustImageWrappersForRotation();

      } catch (error) {
        console.error('Erreur chargement document réintégré:', error);
        placeholder.innerHTML = '<p class="text-danger">Erreur lors du chargement du document</p>';
      }
    }
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
    initPropertiesTabs();
    variableManager.init();
    initGlobalFocusReset();
    initSaveButton();
    initSidebarOptionsButtons();
    initAvailableTemplatesButtons();
    loadDocument().then(() => {
      // Initialiser le canevas après le chargement du document
      initializeCanvasIfNeeded();
    });
  }

  /**
   * Initialise les boutons du panel "Disponible"
   */
  function initAvailableTemplatesButtons() {
    const createTemplateSectionBtn = document.getElementById('createTemplateSectionBtn');
    const importTemplateSectionBtn = document.getElementById('importTemplateSectionBtn');

    if (createTemplateSectionBtn) {
      createTemplateSectionBtn.addEventListener('click', () => {
        // TODO: Ouvrir un modal pour créer un nouveau template de section
        alert('Fonctionnalité "Créer un template de section" à venir...');
      });
    }

    if (importTemplateSectionBtn) {
      importTemplateSectionBtn.addEventListener('click', () => {
        // TODO: Ouvrir un modal pour importer un template de section
        alert('Fonctionnalité "Importer un template de section" à venir...');
      });
    }
  }

  /**
   * Génère un namespace automatiquement pour un template de section
   * @param {string} sectionName - Nom de la section
   * @returns {string} Namespace généré (template:section)
   */
  function generateTemplateNamespace(sectionName) {
    if (!documentTemplateName) {
      console.warn('⚠️ Template document non défini, impossible de générer le namespace');
      return null;
    }

    // Normaliser le nom de la section
    const normalizeAccents = (str) => {
      return str
        .toLowerCase()
        .normalize('NFD') // Décompose les caractères accentués
        .replace(/[\u0300-\u036f]/g, '') // Supprime les diacritiques (accents)
        .replace(/\s+/g, '_') // Remplacer espaces par underscores
        .replace(/[^a-z0-9_]/g, ''); // Garder seulement lettres, chiffres, underscores
    };

    const normalizedSection = normalizeAccents(sectionName);
    return `${documentTemplateName}:${normalizedSection}`;
  }

  /**
   * Initialise les boutons des options dans le sidebar
   */
  function initSidebarOptionsButtons() {
    const createOptionSectionBtn = document.getElementById('createOptionSectionBtnSidebar');
    const createOptionDocumentBtn = document.getElementById('createOptionDocumentBtnSidebar');
    const reintegrateDocumentBtn = document.getElementById('reintegrateDocumentBtnSidebar');

    if (createOptionSectionBtn) {
      createOptionSectionBtn.addEventListener('click', () => {
        openSelectSectionModal();
      });
    }

    if (createOptionDocumentBtn) {
      createOptionDocumentBtn.addEventListener('click', () => {
        openCreateOptionDocumentModal();
      });
    }

    if (reintegrateDocumentBtn) {
      reintegrateDocumentBtn.addEventListener('click', () => {
        openReintegrateDocumentModal();
      });
    }
  }

  /**
   * ===================================
   * MODAL NOM DU TEMPLATE DOCUMENT
   * ===================================
   */

  let documentTemplateName = null; // Nom du template document actuel
  let templateCheckDone = false; // Flag pour éviter les vérifications multiples
  let templateModalVisible = false; // Flag pour savoir si le modal est déjà affiché

  /**
   * Vérifie si le template document existe et affiche le modal si nécessaire
   * @param {Object} jsonContent - Contenu JSON du document (déjà chargé)
   */
  async function checkAndCreateDocumentTemplate(jsonContent = null) {
    // Ne vérifier qu'une seule fois
    if (templateCheckDone || templateModalVisible) {
      return;
    }

    if (!documentId || !apiBase) {
      templateCheckDone = true;
      return;
    }

    try {
      let documentData;
      let jsonContentToUse = jsonContent;
      
      // Si jsonContent n'est pas fourni, récupérer le document
      if (!jsonContentToUse) {
        const docResponse = await fetch(`${apiBase}/agent-documentaire/document/${documentId}`);
        const docPayload = await docResponse.json();
        
        if (!docPayload.success || !docPayload.data) {
          console.error('Erreur récupération document:', docPayload.error);
          templateCheckDone = true;
          return;
        }

        documentData = docPayload.data;
        jsonContentToUse = documentData.json_content || {};
      } else {
        // Utiliser les données déjà chargées
        documentData = { json_content: jsonContentToUse };
      }
      
      // Si le document a déjà un canvas avec un nom, le template est déjà défini
      if (jsonContentToUse.canvas && jsonContentToUse.canvas.metadata && jsonContentToUse.canvas.metadata.name) {
        const templateName = jsonContentToUse.canvas.metadata.name;
        documentTemplateName = templateName;
        console.log('✅ Template document déjà défini dans canvas:', documentTemplateName);
        templateCheckDone = true;
        // Charger les templates disponibles après avoir défini le nom du template
        if (typeof loadAvailableTemplates === 'function') {
          loadAvailableTemplates();
        }
        return;
      }

      // Récupérer le nom du fichier Word pour le nom par défaut du template
      // Si on n'a pas encore documentData avec original_filename, le récupérer
      if (!documentData || documentData.original_filename === undefined) {
        const docResponse = await fetch(`${apiBase}/agent-documentaire/document/${documentId}`);
        const docPayload = await docResponse.json();
        if (docPayload.success && docPayload.data) {
          documentData = docPayload.data;
          if (!jsonContentToUse) {
            jsonContentToUse = documentData.json_content || {};
          }
        }
      }
      
      const originalFilename = documentData?.original_filename || '';
      
      // Fonction pour normaliser les caractères accentués (é → e, à → a, etc.)
      const normalizeAccents = (str) => {
        return str
          .normalize('NFD') // Décompose les caractères accentués (é devient e + accent)
          .replace(/[\u0300-\u036f]/g, ''); // Supprime les diacritiques (accents), garde la lettre de base
      };
      
      // Extraire le nom sans extension pour le template
      let defaultTemplateName = originalFilename
        .replace(/\.docx?$/i, '') // Retirer extension .docx ou .doc
        .toLowerCase()
        .normalize('NFD') // Décompose les caractères accentués (é → e + accent)
        .replace(/[\u0300-\u036f]/g, '') // Supprime les diacritiques (accents), garde la lettre de base
        .replace(/\s+/g, '_') // Remplacer espaces par underscores
        .replace(/[^a-z0-9_]/g, ''); // Garder seulement lettres, chiffres, underscores

      // Si pas de nom, utiliser une valeur par défaut
      if (!defaultTemplateName || defaultTemplateName.length === 0) {
        defaultTemplateName = 'document_template';
      }

      // Vérifier si le template existe déjà en listant tous les templates (évite le 404)
      try {
        const templatesResponse = await fetch(`${apiBase}/agent-documentaire/templates`);
        
        if (templatesResponse.status === 200) {
          const templatesPayload = await templatesResponse.json();
          
          if (templatesPayload.success && Array.isArray(templatesPayload.data)) {
            // Chercher le template dans la liste
            const existingTemplate = templatesPayload.data.find(t => t.namespace === defaultTemplateName);
            
            if (existingTemplate) {
              // Template existe déjà
              documentTemplateName = existingTemplate.namespace;
              console.log('✅ Template document trouvé:', documentTemplateName);
              templateCheckDone = true;
              return;
            }
          }
        }
        // Template n'existe pas encore - on continue pour afficher le modal
      } catch (templateError) {
        // En cas d'erreur, on continue quand même (pas bloquant)
        console.warn('Erreur lors de la vérification du template:', templateError);
      }

      // Template n'existe pas, afficher le modal (une seule fois)
      if (!templateModalVisible) {
        templateModalVisible = true;
        showTemplateNameModal(defaultTemplateName);
      }

      templateCheckDone = true;

    } catch (error) {
      console.error('Erreur vérification template:', error);
      templateCheckDone = true;
      // En cas d'erreur, on continue quand même (pas bloquant)
    }
  }

  /**
   * Affiche le modal pour nommer le template document
   */
  function showTemplateNameModal(defaultName) {
    const modal = document.getElementById('templateNameModal');
    const input = document.getElementById('templateNameInput');
    const submitBtn = document.getElementById('templateNameSubmit');

    if (!modal || !input || !submitBtn) {
      console.error('Modal template name non trouvé');
      return;
    }

    // Définir la valeur par défaut
    input.value = defaultName;

    // Afficher le modal
    modal.style.display = 'flex';

    // Gérer la soumission
    const handleSubmit = async () => {
      const templateName = input.value.trim();
      
      if (!templateName) {
        alert('Veuillez entrer un nom pour le template');
        return;
      }

      // Normaliser le nom (minuscules, underscores, accents convertis : é → e, à → a, etc.)
      const normalizedName = templateName
        .toLowerCase()
        .normalize('NFD') // Décompose les caractères accentués (é → e + accent)
        .replace(/[\u0300-\u036f]/g, '') // Supprime les diacritiques (accents), garde la lettre de base
        .replace(/\s+/g, '_') // Remplacer espaces par underscores
        .replace(/[^a-z0-9_]/g, ''); // Garder seulement lettres, chiffres, underscores

      if (normalizedName.length === 0) {
        alert('Le nom du template n\'est pas valide');
        return;
      }

      // Désactiver le bouton pendant la création
      submitBtn.disabled = true;
      submitBtn.textContent = 'Création...';

      try {
        // Récupérer le document pour créer le template avec son contenu
        const docResponse = await fetch(`${apiBase}/agent-documentaire/document/${documentId}`);
        const docPayload = await docResponse.json();
        
        if (!docPayload.success) {
          throw new Error(docPayload.error || 'Erreur récupération document');
        }

        // Créer le template document
        const createResponse = await fetch(`${apiBase}/agent-documentaire/templates/document`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            namespace: normalizedName,
            documentId: documentId,
            jsonContent: docPayload.data.json_content
          })
        });

        const createPayload = await createResponse.json();
        
        if (!createPayload.success) {
          // Si le template existe déjà (409), c'est OK, on continue
          if (createResponse.status === 409 || createPayload.error?.includes('existe déjà')) {
            documentTemplateName = normalizedName;
            templateCheckDone = true;
            console.log('✅ Template document existe déjà:', documentTemplateName);
            templateModalVisible = false;
            modal.style.display = 'none';
            return;
          }
          throw new Error(createPayload.error || 'Erreur création template');
        }

        // Template créé avec succès
        documentTemplateName = normalizedName;
        templateCheckDone = true;
        console.log('✅ Template document créé:', documentTemplateName);

        // Fermer le modal
        templateModalVisible = false;
        modal.style.display = 'none';

        // Ne pas recharger le document ici pour éviter la boucle
        // Le template est créé, on continue normalement

      } catch (error) {
        console.error('❌ Erreur création template:', error);
        
        // Ne pas afficher d'alert si c'est juste que le template existe
        if (error.message && error.message.includes('existe déjà')) {
          documentTemplateName = normalizedName;
          templateCheckDone = true;
          templateModalVisible = false;
          modal.style.display = 'none';
          return;
        }
        
        alert(`Erreur lors de la création du template: ${error.message}`);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continuer';
      }
    };

    // Écouter le clic sur le bouton
    submitBtn.onclick = handleSubmit;

    // Écouter la touche Enter
    input.onkeypress = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };

    // Gérer la fermeture du modal
    const closeBtn = document.getElementById('templateNameModalClose');
    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.style.display = 'none';
      };
    }

    // Focus sur l'input
    setTimeout(() => input.focus(), 100);
  }

  /**
   * Initialise les événements du modal template name
   */
  function initTemplateNameModal() {
    // La logique est déjà dans showTemplateNameModal
    // On vérifie au chargement du document
    checkAndCreateDocumentTemplate();
  }

  // Appeler la vérification après le chargement initial
  // Modifier loadDocument pour appeler checkAndCreateDocumentTemplate après le chargement

  init();
})();
