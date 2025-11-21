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
   * Charge le document depuis l'API
   */
  async function loadDocument() {
    console.log('[DEBUG] loadDocument() appelé');
    console.log('[DEBUG] documentId:', documentId);
    console.log('[DEBUG] apiBase:', apiBase);
    
    if (!documentId || !apiBase) {
      console.warn('❌ Document ID ou API non disponible');
      console.log('documentId:', documentId);
      console.log('apiBase:', apiBase);
      return;
    }

    const url = `${apiBase}/agent-documentaire/document/${documentId}`;
    console.log('[DEBUG] Appel API:', url);

    try {
      const response = await fetch(url);
      console.log('[DEBUG] Réponse HTTP:', response.status, response.statusText);
      
      const payload = await response.json();
      console.log('[DEBUG] Payload reçu:', payload);
      
      if (!payload.success) {
        throw new Error(payload.error || 'Erreur API');
      }

      documentJson = payload.data.json_content;
      console.log('[DEBUG] documentJson:', documentJson);
      
      sectionsTree = Array.isArray(documentJson.sections) ? documentJson.sections : [];
      console.log('✅ Document chargé:', sectionsTree.length, 'sections');
      console.log('[DEBUG] sectionsTree:', sectionsTree);

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
   */
  function stylesToCSS(styles) {
    if (!styles || typeof styles !== 'object') return '';
    
    const cssProps = [];
    
    // Propriétés de run (texte)
    if (styles.fontFamily) {
      cssProps.push(`font-family: "${styles.fontFamily}"`);
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
    
    // Espacement
    if (styles.spacing) {
      if (styles.spacing.before) {
        cssProps.push(`margin-top: ${styles.spacing.before}pt`);
      }
      if (styles.spacing.after) {
        cssProps.push(`margin-bottom: ${styles.spacing.after}pt`);
      }
      if (styles.spacing.line) {
        cssProps.push(`line-height: ${styles.spacing.line}`);
      }
    }
    
    // Indentation
    if (styles.indentation) {
      if (styles.indentation.left) {
        cssProps.push(`margin-left: ${styles.indentation.left}pt`);
      }
      if (styles.indentation.right) {
        cssProps.push(`margin-right: ${styles.indentation.right}pt`);
      }
      if (styles.indentation.firstLine) {
        cssProps.push(`text-indent: ${styles.indentation.firstLine}pt`);
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

    let html = `<div id="${sectionId}" class="section level-${level}" data-section-id="${sectionId}">`;
    
    // Si la section a un saut de page, ajouter un séparateur avant le titre
    if (section.hasPageBreak) {
      html += `<div class="page-break"><span>Saut de page</span></div>`;
    }
    
    // Titre (ne pas afficher pour l'introduction dans la vue texte)
    if (!hideTitle && !isIntroduction) {
      const headingTag = `h${Math.min(level + 1, 6)}`;
      const displayTitle = numbering ? `${numbering} ${title}` : title;
      html += `<${headingTag} class="section-title">${displayTitle}</${headingTag}>`;
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
        const styleAttr = stylesToCSS(styles);
        const styleString = styleAttr ? ` style="${styleAttr}"` : '';
        
        // Si le paragraphe est vide, afficher &nbsp; pour faciliter l'édition future
        const displayText = text.trim() === '' ? '&nbsp;' : text;
        
        html += `<p${styleString}>${displayText}</p>`;
      } else if (item.type === 'image') {
        const src = item.src || '';
        const alt = item.alt || 'Image';
        const width = item.width || '';
        const height = item.height || '';
        let styleAttr = '';
        
        if (width || height) {
          const styleProps = [];
          if (width) styleProps.push(`width: ${width}px`);
          if (height) styleProps.push(`height: ${height}px`);
          styleAttr = ` style="${styleProps.join('; ')}"`;
        }
        
        html += `<img src="${src}" alt="${alt}"${styleAttr} />`;
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
    
    // Ne pas afficher la section "Sommaire" dans le sommaire
    const titleLower = title.toLowerCase().trim();
    if (titleLower === 'sommaire' || section.type === 'sommaire' || section.isSommaire) {
      return '';
    }

    // Génération HTML SIMPLIFIÉE - UNIQUEMENT le titre, pas de contenu
    let html = `<div class="section level-${level}" data-section-id="${sectionId}">`;
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
   * Initialisation
   */
  function init() {
    initViewTabs();
    initCardBackButton();
    loadDocument();
  }

  init();
})();
