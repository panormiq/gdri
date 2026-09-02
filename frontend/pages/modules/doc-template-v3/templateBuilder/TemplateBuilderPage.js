// src/modules/editor/templateBuilder/TemplateBuilderPage.js
import Page from '../shared/components/page/Page.js';
import LeftPanel from './components/leftPanel/LeftPanel.js';
import RichTextEditor from './components/editor/RichTextEditor.js';
import RightPanel from './components/rightPanel/RightPanel.js';
import FormatTab from './components/rightPanel/FormatTab.js';
import { extractStructureFromHTML } from './utils/templateRefactorer.js';
import { flattenSections } from './utils/sectionHierarchy.js';
import { formatHierarchicalNumbering } from './utils/numberingUtils.js';
import { normalizeTemplateKind, editorPath } from '../template/templateKinds.js?v=tpl-kind-3';
import { canvasEditorUrl, canvasNamespaceForTemplate } from '../app/canvasEditor.js';

// Charger le CSS
(function loadCSS() {
  if (!document.getElementById('template-builder-styles')) {
    const link = document.createElement('link');
    link.id = 'template-builder-styles';
    link.rel = 'stylesheet';
    const baseUrl = window.BASE_URL || '/';
    link.href = baseUrl + 'pages/modules/doc-template-v3/templateBuilder/TemplateBuilderPage.css';
    document.head.appendChild(link);
  }
})();

export default class TemplateBuilderPage extends Page {
  constructor(router, templateId = null, kind = 'word') {
    super(router);
    console.log('🏗️ TemplateBuilderPage constructor appelé, templateId:', templateId);
    this.templateId = templateId;
    this.kind = kind || 'word';
    this.template = null;
    this.leftPanel = null;
    this.editor = null;
    this.rightPanel = null;
    this.formatTab = null;
    this.isSyncingStructure = false; // Flag pour éviter les boucles infinies lors de la synchronisation
  }

  async render(container) {
    container.innerHTML = '';
    
    console.log('📄 TemplateBuilderPage.render appelé, templateId:', this.templateId);

    // Header avec titre et bouton de sauvegarde
    const header = document.createElement('div');
    header.className = 'template-builder-header';
    
    const listButton = document.createElement('button');
    listButton.className = 'template-list-button';
    listButton.textContent = '← Templates';
    listButton.title = 'Retour à la liste des templates';
    listButton.onclick = () => this.router.navigate('/templates');
    
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'template-title-input';
    titleInput.placeholder = 'Nom du template';
    titleInput.value = this.template?.name || 'Nouveau Template';
    
    const saveButton = document.createElement('button');
    saveButton.className = 'template-save-button';
    saveButton.textContent = this.templateId ? 'Enregistrer' : 'Créer';
    console.log('🔘 Bouton texte:', saveButton.textContent);
    saveButton.onclick = () => this.handleSave();
    
    header.appendChild(listButton);
    header.appendChild(titleInput);
    header.appendChild(saveButton);
    container.appendChild(header);
    
    // Container pour FormatTab sous le header
    const formatContainer = document.createElement('div');
    formatContainer.className = 'template-builder-format-container';
    formatContainer.id = 'template-builder-format-container';
    container.appendChild(formatContainer);
    
    // Container principal avec 3 colonnes
    const builderContainer = document.createElement('div');
    builderContainer.className = 'template-builder-container';

    // Colonne gauche
    const leftColumn = document.createElement('div');
    leftColumn.className = 'template-builder-left';
    leftColumn.id = 'template-builder-left';

    // Colonne centrale (éditeur)
    const centerColumn = document.createElement('div');
    centerColumn.className = 'template-builder-center';
    centerColumn.id = 'template-builder-center';

    // Colonne droite
    const rightColumn = document.createElement('div');
    rightColumn.className = 'template-builder-right';
    rightColumn.id = 'template-builder-right';

    builderContainer.appendChild(leftColumn);
    builderContainer.appendChild(centerColumn);
    builderContainer.appendChild(rightColumn);
    container.appendChild(builderContainer);

    // Footer personnalisé pour l'app
    const footer = document.createElement('div');
    footer.className = 'template-builder-footer';
    footer.style.height = '20px';
    footer.style.width = '100%';
    footer.style.backgroundColor = 'var(--color-light)';
    footer.style.flexShrink = '0';
    container.appendChild(footer);

    // Charger le template si templateId fourni
    if (this.templateId) {
      console.log('📥 Chargement du template avec ID:', this.templateId);
      try {
        await this.loadTemplate();
        if (this._redirected) return;
        if (!this.template) {
          throw new Error('Le template n\'a pas pu être chargé');
        }
        console.log('✅ Template chargé:', this.template.name);
        titleInput.value = this.template?.name || 'Nouveau Template';
        // Mettre à jour le bouton maintenant que le template est chargé
        saveButton.textContent = 'Enregistrer';
      } catch (error) {
        console.error('❌ Erreur lors du chargement du template:', error);
        container.innerHTML = `
          <div style="padding: 2rem; text-align: center;">
            <h2>Erreur de chargement</h2>
            <p style="color: #d32f2f;">${error.message || 'Le template n\'a pas pu être chargé'}</p>
            <p>ID du template: <code>${this.templateId}</code></p>
            <a href="${this.router.basePath || '/'}/templates" data-link style="display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: #1976d2; color: white; text-decoration: none; border-radius: 4px;">Retour à la liste</a>
          </div>
        `;
        return;
      }
    } else {
      // Créer un template vide avec structure par défaut
      this.template = this.createDefaultTemplate();
    }

    // Stocker la référence au champ titre
    this.titleInput = titleInput;
    
    // Mettre à jour le titre quand il change
    titleInput.oninput = () => {
      if (this.template) {
        this.template.name = titleInput.value || 'Nouveau Template';
      }
    };

    // Initialiser les composants
    this.initComponents();
  }

  async loadTemplate() {
    console.log('🔄 loadTemplate appelé pour templateId:', this.templateId);
    const { templateApi } = await import('../shared/api/TemplateApi.js');
    const response = await templateApi.getById(this.templateId);
    console.log('📦 Réponse API:', response);
    
    if (response.success && response.data) {
      this.template = response.data;
      const kind = normalizeTemplateKind(this.template);
      if (kind !== 'word') {
        this._redirected = true;
        if (kind === 'canvas') {
          window.location.href = canvasEditorUrl({
            template: canvasNamespaceForTemplate(this.template),
          });
        } else if (this.router) {
          this.router.navigate(editorPath(kind, this.templateId));
        }
        return;
      }
      this.template.kind = 'word';
      this.kind = 'word';
      console.log('✅ Template chargé depuis la base de données:', {
        id: this.template._id,
        name: this.template.name,
        hasContent: !!this.template.content,
        contentLength: this.template.content?.length || 0
      });
      // S'assurer que la structure existe
      if (!this.template.structure || !this.template.structure.sections) {
        this.template.structure = this.createDefaultTemplate().structure;
      }
      
      // Mettre à jour le champ titre si il existe
      if (this.titleInput) {
        this.titleInput.value = this.template.name || 'Nouveau Template';
      }
    } else {
      const errorMsg = response.error || 'Template non trouvé';
      console.error('❌ Erreur chargement template:', errorMsg);
      throw new Error(errorMsg);
    }
  }

  createDefaultTemplate() {
    let name = 'Nouveau Template';
    try {
      const pending = JSON.parse(sessionStorage.getItem('gdriNewTemplate') || 'null');
      if (pending && pending.name) name = String(pending.name);
      if (pending && pending.kind) this.kind = pending.kind;
      sessionStorage.removeItem('gdriNewTemplate');
    } catch (e) {
      sessionStorage.removeItem('gdriNewTemplate');
    }
    return {
      name,
      kind: this.kind || 'word',
      generalStyles: {
        default: {
          fontFamily: 'Arial',
          fontSize: 12,
          color: '#000000',
          lineHeight: 1.5,
          margin: {
            top: '2.5cm',
            right: '2cm',
            bottom: '2.5cm',
            left: '2cm'
          },
          pagination: {
            pageSize: 'A4',
            orientation: 'portrait',
            headerHeight: '1.5cm',
            footerHeight: '1.5cm'
          },
          textAlign: 'left'
        },
        overrides: {}
      },
      structure: {
        id: 'doc_root',
        type: 'document',
        level: 0,
        visibleInTOC: false,
        sections: [
          {
            id: 'sec_intro',
            type: 'section',
            level: 1,
            title: 'Introduction',
            visibleInTOC: true,
            paragraphs: [],
            sections: []
          }
        ]
      },
      defaultCollection: null, // Sera défini par l'utilisateur
      additionalCollections: []
    };
  }

  initComponents() {
    // Initialiser FormatTab sous le header
    const formatContainer = document.getElementById('template-builder-format-container');
    this.formatTab = new FormatTab({
      onFormat: (command, value) => {
        console.log('🔘 TemplateBuilderPage.onFormat appelé:', command, value);
        if (this.editor && this.editor.applyFormat) {
          console.log('✅ Appel de editor.applyFormat');
          this.editor.applyFormat(command, value);
        } else {
          console.error('❌ Editor ou applyFormat non disponible:', {
            editor: this.editor,
            hasApplyFormat: this.editor?.applyFormat
          });
        }
      },
      template: this.template,
      editor: null // Sera mis à jour après la création de l'éditeur
    });
    this.formatTab.render(formatContainer);

    // Initialiser le panneau gauche
    const leftContainer = document.getElementById('template-builder-left');
    this.leftPanel = new LeftPanel({
      template: this.template,
      onSectionSelect: (sectionId) => this.onSectionSelect(sectionId),
      onSectionReorder: (sections) => this.onSectionReorder(sections)
    });
    this.leftPanel.render(leftContainer);

    // Initialiser l'éditeur central
    const centerContainer = document.getElementById('template-builder-center');
    this.editor = new RichTextEditor({
      template: this.template,
      onContentChange: (content) => this.onContentChange(content),
      onTitleCreated: (headingLevel) => this.onTitleCreated(headingLevel),
      onSectionChange: (sectionId) => this.onEditorSectionChange(sectionId),
      onTitleLevelChanged: (sectionId, newLevel) => this.onTitleLevelChanged(sectionId, newLevel),
      onTitleDeleted: (sectionId) => this.onTitleDeleted(sectionId)
    });
    this.editor.render(centerContainer);
    
    // Mettre à jour la référence de l'éditeur dans FormatTab
    if (this.formatTab) {
      this.formatTab.setEditor(this.editor);
    }
    
    // Le contenu HTML sera chargé automatiquement par renderAllSections() si template.content existe
    // Pas besoin de le charger ici car renderAllSections() vérifie maintenant template.content en premier

    // Initialiser le panneau droit
    const rightContainer = document.getElementById('template-builder-right');
    this.rightPanel = new RightPanel({
      template: this.template,
      onTemplateChange: (changes) => this.onTemplateChange(changes),
      onFieldDrop: (fieldPath) => this.onFieldDrop(fieldPath)
    });
    this.rightPanel.render(rightContainer);
  }

  onSectionSelect(sectionId) {
    // Recréer le JSON depuis le HTML avant de naviguer
    this.refactorTemplateFromHTML();
    
    if (this.editor) {
      // Naviguer vers la section (scroll) au lieu de charger uniquement cette section
      this.editor.scrollToSection(sectionId);
    }
    if (this.rightPanel) {
      this.rightPanel.setCurrentSection(sectionId);
    }
  }
  
  onEditorSectionChange(sectionId) {
    // Quand l'utilisateur clique dans l'éditeur, mettre à jour la section active dans le TOC
    // On passe notify=false pour éviter de déclencher onSectionSelect (qui scrollerait)
    if (this.leftPanel) {
      this.leftPanel.selectSection(sectionId, false);
    }
    if (this.rightPanel) {
      this.rightPanel.setCurrentSection(sectionId);
    }
  }

  onSectionReorder(sections) {
    if (this.template && this.template.structure) {
      // Sauvegarder le HTML actuel AVANT de modifier quoi que ce soit
      // Cela préserve tout le formatage, les images, etc.
      if (this.editor && this.editor.editorElement) {
        this.template.content = this.editor.editorElement.innerHTML;
      }
      
      // Mettre à jour la structure directement (déjà hiérarchique)
      this.template.structure.sections = sections;
      
      // Réordonner les éléments dans le DOM directement au lieu de tout re-render
      // Cela préserve le HTML existant
      if (this.editor && this.editor.editorElement) {
        this.reorderSectionsInDOM(sections);
        
        // Normaliser tous les titres pour garantir l'uniformité des styles
        this.editor.normalizeTitleElements();
        
        // Mettre à jour la numérotation sans re-render tout le contenu
        this.updateNumberingInEditor();
        
        // Réappliquer les styles après normalisation et réordonnancement
        this.editor.applyLayoutStyles();
        
        // Mettre à jour template.content avec le HTML réordonné
        this.template.content = this.editor.editorElement.innerHTML;
        
        // Recalculer les spacers de page après le réordonnancement
        setTimeout(() => {
          this.editor.recalculateAllSpacers();
        }, 100);
      }
      
      // Mettre à jour le LeftPanel
      if (this.leftPanel) {
        this.leftPanel.setTemplate(this.template);
      }
    }
  }
  
  /**
   * Réordonne les sections dans le DOM selon la nouvelle structure
   * Préserve le HTML existant au lieu de tout re-render
   */
  reorderSectionsInDOM(sections) {
    if (!this.editor || !this.editor.editorElement) return;
    
    // Aplatir la hiérarchie pour obtenir l'ordre
    const flatList = flattenSections(sections);
    
    // Créer une map des éléments par sectionId
    const elementsMap = new Map();
    const allChildren = Array.from(this.editor.editorElement.children);
    
    // Parcourir tous les enfants et les regrouper par section
    let currentSectionId = null;
    let currentSectionElements = [];
    
    for (const child of allChildren) {
      // Vérifier si c'est un titre
      const tagName = child.tagName ? child.tagName.toLowerCase() : '';
      const className = child.className || '';
      const isTitle = /^h[1-3]$/i.test(tagName) || (tagName === 'div' && /doc-title-level-[1-3]/.test(className));
      
      if (isTitle) {
        // Sauvegarder la section précédente si elle existe
        if (currentSectionId && currentSectionElements.length > 0) {
          elementsMap.set(currentSectionId, currentSectionElements);
        }
        
        // Nouvelle section
        const sectionId = child.dataset.sectionId;
        if (sectionId) {
          currentSectionId = sectionId;
          currentSectionElements = [child];
        } else {
          currentSectionId = null;
          currentSectionElements = [];
        }
      } else if (currentSectionId) {
        // C'est un paragraphe ou autre contenu de la section actuelle
        currentSectionElements.push(child);
      } else {
        // Élément orphelin, le garder à la fin
        if (!elementsMap.has('_orphans')) {
          elementsMap.set('_orphans', []);
        }
        elementsMap.get('_orphans').push(child);
      }
    }
    
    // Sauvegarder la dernière section
    if (currentSectionId && currentSectionElements.length > 0) {
      elementsMap.set(currentSectionId, currentSectionElements);
    }
    
    // Retirer tous les éléments de l'éditeur (sans les détruire)
    // On les stocke dans un tableau pour les réinsérer ensuite
    const allElements = Array.from(this.editor.editorElement.children);
    allElements.forEach(el => {
      this.editor.editorElement.removeChild(el);
    });
    
    // Réinsérer les éléments dans le nouvel ordre selon la structure
    for (const { section } of flatList) {
      const elements = elementsMap.get(section.id);
      if (elements && elements.length > 0) {
        elements.forEach(el => {
          this.editor.editorElement.appendChild(el);
        });
      }
    }
    
    // Ajouter les éléments orphelins à la fin
    const orphans = elementsMap.get('_orphans');
    if (orphans && orphans.length > 0) {
      orphans.forEach(el => {
        this.editor.editorElement.appendChild(el);
      });
    }
  }

  onContentChange(content) {
    // Éviter les boucles infinies
    if (this.isSyncingStructure) {
      return;
    }
    
    // Synchroniser la structure avec le HTML après chaque modification
    // Cela permet de détecter les titres supprimés ou modifiés
    // Utiliser un délai pour éviter de synchroniser à chaque frappe
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    
    this.syncTimeout = setTimeout(() => {
      this.syncStructureFromHTML();
    }, 300); // Délai de 300ms pour éviter trop de synchronisations
  }
  
  syncStructureFromHTML() {
    // Synchroniser la structure du template avec le HTML de l'éditeur
    // Cela permet de détecter les sections supprimées (titres transformés en paragraphes ou supprimés)
    if (!this.editor || !this.editor.editorElement || !this.template || !this.template.structure) {
      return;
    }
    
    // Éviter les boucles infinies
    if (this.isSyncingStructure) {
      return;
    }
    
    this.isSyncingStructure = true;
    
    try {
      // Extraire la nouvelle structure depuis le HTML
      const extractedHierarchy = extractStructureFromHTML(this.editor.editorElement);
      
      if (extractedHierarchy && Array.isArray(extractedHierarchy)) {
        // Remplacer la structure par celle extraite du HTML
        // Cela supprime automatiquement les sections qui n'ont plus de titre dans le HTML
        this.template.structure.sections = extractedHierarchy;
        
        // Mettre à jour le TOC (LeftPanel) - cela met à jour la numérotation aussi
        if (this.leftPanel) {
          this.leftPanel.setTemplate(this.template);
        }
        
        // Ne pas re-render tout l'éditeur car cela écraserait les modifications de l'utilisateur
        // La numérotation sera mise à jour via le LeftPanel qui utilise la structure mise à jour
        // Si besoin de mettre à jour la numérotation dans l'éditeur, on peut le faire sans tout re-render
        this.updateNumberingInEditor();
      }
    } finally {
      // Réinitialiser le flag après un court délai
      setTimeout(() => {
        this.isSyncingStructure = false;
      }, 100);
    }
  }
  
  updateNumberingInEditor() {
    // Mettre à jour uniquement la numérotation dans les titres sans écraser le contenu
    if (!this.editor || !this.editor.editorElement || !this.template || !this.template.structure) {
      return;
    }
    
    // Sauvegarder la position du curseur avant modification
    const selection = window.getSelection();
    let savedRange = null;
    let savedTitleElement = null;
    let savedOffset = 0;
    
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let element = range.commonAncestorContainer;
      
      // Si c'est un nœud texte, remonter au parent
      if (element.nodeType === Node.TEXT_NODE) {
        element = element.parentElement;
        savedOffset = range.startOffset;
      } else {
        savedOffset = range.startOffset;
      }
      
      // Trouver le titre parent si on est dedans
      while (element && element !== this.editor.editorElement) {
        const tagName = element.tagName ? element.tagName.toLowerCase() : '';
        const className = element.className || '';
        const isTitle = /^h[1-3]$/i.test(tagName) || (tagName === 'div' && /doc-title-level-[1-3]/.test(className));
        
        if (isTitle) {
          savedTitleElement = element;
          // Calculer l'offset dans le texte du titre
          const titleText = element.textContent || '';
          savedOffset = range.startOffset;
          break;
        }
        element = element.parentElement;
      }
      
      // Sauvegarder le range complet
      savedRange = range.cloneRange();
    }
    
    const flatList = flattenSections(this.template.structure.sections || []);
    const numberingType = this.template?.generalStyles?.numbering?.type || 'numeric';
    const numberingCustom = this.template?.generalStyles?.numbering?.custom || '{n}.';
    
    // Mettre à jour la numérotation dans chaque titre existant
    flatList.forEach(({ section, path }) => {
      const titleElement = this.editor.editorElement.querySelector(`[data-section-id="${section.id}"]`);
      if (titleElement) {
        const tagName = titleElement.tagName ? titleElement.tagName.toLowerCase() : '';
        const className = titleElement.className || '';
        
        // Vérifier si c'est un h1/h2/h3 ou un div avec classe doc-title-level-X
        const isTitle = /^H[1-3]$/i.test(tagName) || (tagName === 'div' && /doc-title-level-[1-3]/.test(className));
        
        if (isTitle) {
          const number = formatHierarchicalNumbering(path, numberingType, numberingCustom);
          
          // Vérifier si c'est le titre où se trouve le curseur
          const isCurrentTitle = savedTitleElement === titleElement;
          let titleText = '';
          let cursorOffset = 0;
          
          if (isCurrentTitle) {
            // Sauvegarder le texte actuel et la position du curseur
            const currentText = titleElement.textContent || '';
            // Extraire le texte sans la numérotation actuelle
            titleText = currentText.replace(/^[\d\w\.]+\s+/, '').trim();
            if (!titleText || titleText.length < 2) {
              titleText = currentText.trim();
            }
            
            // Calculer la nouvelle position du curseur
            // L'offset actuel est dans le texte avec l'ancienne numérotation
            const oldNumberMatch = currentText.match(/^[\d\w\.]+\s+/);
            const oldNumberLength = oldNumberMatch ? oldNumberMatch[0].length : 0;
            
            // Si le curseur est après la numérotation, ajuster
            if (savedOffset > oldNumberLength) {
              cursorOffset = savedOffset - oldNumberLength + number.length + 1; // +1 pour l'espace
            } else {
              // Le curseur est dans la numérotation, le mettre après la nouvelle
              cursorOffset = number.length + 1;
            }
          } else {
            // Pour les autres titres, juste extraire le texte
            titleText = titleElement.textContent.trim();
            titleText = titleText.replace(/^[\d\w\.]+\s+/, '').trim();
            if (!titleText || titleText.length < 2) {
              titleText = titleElement.textContent.trim();
            }
          }
          
          // Mettre à jour avec la nouvelle numérotation
          titleElement.textContent = `${number} ${titleText}`;
          
          // Restaurer la position du curseur si c'est le titre actuel
          if (isCurrentTitle && cursorOffset > 0) {
            setTimeout(() => {
              const textNode = titleElement.firstChild;
              if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                const newRange = document.createRange();
                const maxOffset = Math.min(cursorOffset, textNode.textContent.length);
                newRange.setStart(textNode, maxOffset);
                newRange.setEnd(textNode, maxOffset);
                selection.removeAllRanges();
                selection.addRange(newRange);
              }
            }, 0);
          }
        }
      }
    });
  }
  
  onTitleCreated(headingLevel) {
    // Créer une nouvelle section quand un titre est créé
    this.createSectionFromTitle(headingLevel);
  }
  
  onTitleLevelChanged(sectionId, newLevel) {
    // Changer le niveau d'une section existante
    this.changeSectionLevel(sectionId, newLevel);
  }
  
  onTitleDeleted(sectionId) {
    // Supprimer une section du template quand son titre est supprimé ou transformé en paragraphe
    // La synchronisation se fera automatiquement via syncStructureFromHTML
    // On force la synchronisation immédiatement
    setTimeout(() => {
      this.syncStructureFromHTML();
    }, 50);
  }
  
  changeSectionLevel(sectionId, newLevel) {
    if (!this.template || !this.template.structure) return;
    
    const sections = this.template.structure.sections || [];
    const sectionIndex = sections.findIndex(s => s.id === sectionId);
    
    if (sectionIndex >= 0) {
      // Mettre à jour le niveau de la section
      sections[sectionIndex].level = newLevel;
      
      // Recréer le JSON depuis le HTML pour éviter les pertes
      this.refactorTemplateFromHTML();
      
      // Re-render pour régénérer la numérotation
      if (this.editor) {
        this.editor.renderAllSections();
      }
      
      // Mettre à jour le LeftPanel
      if (this.leftPanel) {
        this.leftPanel.setTemplate(this.template);
      }
      
      console.log('✅ Niveau de section changé:', sectionId, '→', newLevel);
    }
  }
  
  createSectionFromTitle(headingLevel) {
    if (!this.editor || !this.template || !this.template.structure) return;
    
    // Récupérer le titre depuis l'élément sélectionné dans l'éditeur
    if (!this.editor.editorElement) return;
    
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    let titleElement = range.commonAncestorContainer;
    
    // Si c'est un nœud texte, remonter au parent jusqu'à trouver un titre
    if (titleElement.nodeType === Node.TEXT_NODE) {
      titleElement = titleElement.parentElement;
    }
    
    // Remonter dans la hiérarchie jusqu'à trouver un élément h1/h2/h3 ou div avec classe doc-title-level-X
    while (titleElement && titleElement !== this.editor.editorElement) {
      const tagName = titleElement.tagName ? titleElement.tagName.toLowerCase() : '';
      const className = titleElement.className || '';
      
      if (tagName && /^h[1-3]$/i.test(tagName)) {
        break;
      } else if (tagName === 'div' && /doc-title-level-[1-3]/.test(className)) {
        break;
      }
      titleElement = titleElement.parentElement;
    }
    
    // Vérifier si on a trouvé un titre
    if (!titleElement) {
      console.warn('⚠️ Titre non trouvé après création');
      return;
    }
    
    const tagName = titleElement.tagName ? titleElement.tagName.toLowerCase() : '';
    const className = titleElement.className || '';
    const isTitle = /^h[1-3]$/i.test(tagName) || (tagName === 'div' && /doc-title-level-[1-3]/.test(className));
    
    if (!isTitle) {
      console.warn('⚠️ Élément trouvé n\'est pas un titre');
      return;
    }
    
    // Extraire le titre (sans la numérotation si elle existe)
    let titleText = titleElement.textContent.trim();
    
    // Retirer la numérotation au début si elle existe (format: "1. ", "a. ", etc.)
    titleText = titleText.replace(/^[\d\w]+\s*\.\s+/, '').trim();
    
    // Si après le remplacement il ne reste rien, garder le texte original
    if (!titleText || titleText.length < 2) {
      titleText = titleElement.textContent.trim();
    }
    
    // Si toujours vide, mettre une valeur par défaut
    if (!titleText) {
      titleText = 'Nouvelle section';
    }
    
    // Générer un ID unique pour la nouvelle section
    const sectionId = `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Mettre à jour le titre dans le DOM (ajouter data-section-id)
    // Le titre existe déjà dans le DOM (créé par formatBlock)
    if (this.editor && this.editor.editorElement && titleElement) {
      titleElement.dataset.sectionId = sectionId;
      console.log('🔖 SectionId assigné au titre:', sectionId, titleElement);
    }
    
    // Attendre un peu pour que le titre soit complètement inséré dans le DOM
    // et que le DOM soit à jour avant d'extraire la structure
    setTimeout(() => {
      try {
        // Vérifier que le titre est bien un enfant direct de editorElement
        const titleInChildren = Array.from(this.editor.editorElement.children).includes(titleElement);
        if (!titleInChildren) {
          console.warn('⚠️ Titre pas encore dans les enfants directs, recherche...');
          // Chercher le titre dans le DOM
          const foundTitle = this.editor.editorElement.querySelector(`[data-section-id="${sectionId}"]`);
          if (foundTitle && foundTitle !== titleElement) {
            titleElement = foundTitle;
          }
        }
        
        // Vérifier que le titre a bien le data-section-id
        if (titleElement && !titleElement.dataset.sectionId) {
          console.warn('⚠️ data-section-id manquant, restauration...');
          titleElement.dataset.sectionId = sectionId;
        }
        
        // Recréer le JSON depuis le HTML pour éviter les pertes et reconstruire la hiérarchie
        // La structure hiérarchique sera reconstruite automatiquement depuis le HTML
        this.refactorTemplateFromHTML();
        
        // Vérifier que la section est bien dans la structure
        const flatList = flattenSections(this.template.structure.sections || []);
        const sectionFound = flatList.find(({ section }) => section.id === sectionId);
        
        if (!sectionFound) {
          console.warn('⚠️ Section non trouvée dans la structure, vérification du DOM...');
          // Vérifier que le titre est bien dans le DOM
          const titleInDOM = this.editor.editorElement.querySelector(`[data-section-id="${sectionId}"]`);
          if (titleInDOM) {
            console.log('✅ Titre trouvé dans le DOM, réextraction...');
            // S'assurer que le data-section-id est bien présent
            if (!titleInDOM.dataset.sectionId) {
              titleInDOM.dataset.sectionId = sectionId;
            }
            // Forcer la réextraction
            this.refactorTemplateFromHTML();
            
            // Vérifier à nouveau
            const flatList2 = flattenSections(this.template.structure.sections || []);
            const sectionFound2 = flatList2.find(({ section }) => section.id === sectionId);
            if (sectionFound2) {
              console.log('✅ Section trouvée après réextraction:', sectionFound2.section);
            } else {
              console.error('❌ Section toujours non trouvée après réextraction');
              // Afficher tous les enfants pour déboguer
              const children = Array.from(this.editor.editorElement.children);
              console.log('Enfants de editorElement:', children.map(el => ({
                tag: el.tagName,
                class: el.className,
                sectionId: el.dataset.sectionId,
                text: el.textContent?.substring(0, 50),
                isTitle: /^h[1-3]$/i.test(el.tagName) || (el.tagName === 'DIV' && /doc-title-level-[1-3]/.test(el.className))
              })));
              
              // Vérifier si le titre est dans les enfants
              const titleInChildren = children.find(el => el.dataset.sectionId === sectionId);
              if (titleInChildren) {
                console.log('✅ Titre trouvé dans les enfants directs:', titleInChildren);
                // Vérifier pourquoi extractStructureFromHTML ne le détecte pas
                const tagName = titleInChildren.tagName ? titleInChildren.tagName.toLowerCase() : '';
                const className = titleInChildren.className || '';
                console.log('Tag:', tagName, 'Class:', className);
                const isH = /^h[1-3]$/i.test(tagName);
                const isDiv = tagName === 'div' && /doc-title-level-[1-3]/.test(className);
                console.log('Est H1-H3:', isH, 'Est div avec classe:', isDiv);
              } else {
                console.error('❌ Titre avec sectionId', sectionId, 'non trouvé dans les enfants directs');
              }
            }
          } else {
            console.error('❌ Titre non trouvé dans le DOM');
          }
        } else {
          console.log('✅ Section trouvée dans la structure:', sectionFound.section);
        }
        
        // Mettre à jour la numérotation SANS re-render tout le contenu (pour éviter d'écraser le HTML)
        // Cela préserve le contenu existant et met juste à jour les numéros
        if (this.editor && this.editor.editorElement) {
          this.updateNumberingInEditor();
          
          // Mettre à jour template.content avec le HTML actuel du DOM (qui contient le nouveau titre)
          // updateNumberingInEditor() modifie le DOM de manière synchrone, donc on peut sauvegarder immédiatement
          const currentHTML = this.editor.editorElement.innerHTML;
          if (currentHTML && currentHTML.trim().length > 0) {
            this.template.content = currentHTML;
          } else {
            console.warn('⚠️ Contenu HTML vide après création de titre');
          }
        }
        
        // Mettre à jour le LeftPanel (TOC)
        if (this.leftPanel) {
          this.leftPanel.setTemplate(this.template);
        }
        
        console.log('✅ Nouvelle section créée:', { id: sectionId, level: parseInt(headingLevel.charAt(1)), title: titleText });
      } catch (error) {
        console.error('❌ Erreur lors de la création de la section:', error);
        // En cas d'erreur, essayer de restaurer le contenu depuis le DOM
        if (this.editor && this.editor.editorElement) {
          this.template.content = this.editor.editorElement.innerHTML;
        }
      }
      }, 50); // Petit délai pour s'assurer que le DOM est à jour
  }
  
  refactorTemplateFromHTML() {
    // Fonction de refactorisation : synchroniser le HTML avec la structure
    if (!this.editor || !this.editor.editorElement || !this.template || !this.template.structure) {
      return;
    }
    
    // Extraire la structure hiérarchique depuis le HTML
    // extractStructureFromHTML retourne maintenant une structure hiérarchique
    const extractedHierarchy = extractStructureFromHTML(this.editor.editorElement);
    
    if (extractedHierarchy && extractedHierarchy.length >= 0) {
      // Remplacer complètement la structure (car c'est maintenant hiérarchique)
      this.template.structure.sections = extractedHierarchy;
      
      console.log('🔄 Template refactorisé depuis le HTML (hiérarchie)');
    }
  }

  onTemplateChange(changes) {
    // Mettre à jour le template
    Object.assign(this.template, changes);
    
    // Mettre à jour FormatTab si les styles d'image changent
    if (this.formatTab && changes.imageStyles !== undefined) {
      this.formatTab.setTemplate(this.template);
    }
    
    // Appliquer les styles de mise en page à l'éditeur
    if (this.editor && changes.generalStyles) {
      this.editor.applyLayoutStyles();
      
      // Si la pagination a changé (format/orientation), recalculer le scaling
      if (changes.generalStyles.default?.pagination) {
        if (this.editor.applyPageFormat) {
          this.editor.applyPageFormat();
        }
      }
      
      // Si la numérotation a changé, re-render les sections et le TOC
      if (changes.generalStyles.numbering) {
        if (this.editor) {
          this.editor.renderAllSections();
        }
        if (this.leftPanel) {
          this.leftPanel.setTemplate(this.template);
        }
      }
    }
  }

  onFieldDrop(fieldPath) {
    // Insérer la variable dans l'éditeur
    if (this.editor) {
      this.editor.insertVariable(fieldPath);
    }
  }

  async handleSave() {
    try {
      // S'assurer que le template est sauvegardé avant d'uploader les images
      // Si le template n'a pas d'ID, on doit d'abord le créer
      if (!this.templateId) {
        // Mettre à jour le nom du template depuis le champ
        if (this.titleInput && this.template) {
          this.template.name = this.titleInput.value || 'Nouveau Template';
        }
        
        // Extraire le HTML de l'éditeur
        if (this.editor && this.editor.editorElement) {
          this.template.content = this.editor.editorElement.innerHTML;
        }
        
        // Refactoriser avant sauvegarde
        const refactoredTemplate = this.refactorTemplate(this.template);
        refactoredTemplate.kind = 'word';
        
        const { templateApi } = await import('../shared/api/TemplateApi.js');
        const createResponse = await templateApi.create(refactoredTemplate);
        
        if (createResponse.success && createResponse.data._id) {
          this.templateId = createResponse.data._id;
          this.template._id = createResponse.data._id;
          // Mettre à jour l'éditeur avec le template ayant l'ID
          if (this.editor) {
            this.editor.template = this.template;
          }
          // Mettre à jour l'URL pour refléter le nouvel ID (sans recharger la page)
          if (this.router) {
            // Utiliser history.pushState pour mettre à jour l'URL sans recharger
            window.history.pushState({}, '', `${this.router.basePath || ''}/templates/edit/${this.templateId}`);
          }
          // Mettre à jour le bouton
          const saveButton = document.querySelector('.template-save-button');
          if (saveButton) {
            saveButton.textContent = 'Enregistrer';
          }
        } else {
          alert('Erreur lors de la création du template: ' + (createResponse.error || 'Erreur inconnue'));
          return createResponse;
        }
      }
      
      // Uploader toutes les images en attente
      if (this.editor && this.editor.getPendingImageUploads) {
        const pendingUploads = this.editor.getPendingImageUploads();
        
        if (pendingUploads.length > 0) {
          console.log(`📤 Upload de ${pendingUploads.length} image(s) en attente...`);
          
          for (const { img, file } of pendingUploads) {
            try {
              const imageData = await this.editor.uploadImage(file);
              if (imageData) {
                // Mettre à jour l'image avec les données de l'upload
                this.editor.updateImageAfterUpload(img, imageData);
                console.log('✅ Image uploadée:', imageData.fileName);
              }
            } catch (error) {
              console.error('❌ Erreur upload image:', error);
              // On continue avec les autres images même si une échoue
              // On affiche un avertissement mais on ne bloque pas la sauvegarde
              console.warn(`⚠️ Échec de l'upload de l'image "${file.name}". L'image temporaire sera conservée.`);
            }
          }
        }
      }
      
      // Mettre à jour le nom du template depuis le champ
      if (this.titleInput && this.template) {
        this.template.name = this.titleInput.value || 'Nouveau Template';
      }
      
      // Attendre un peu pour que toutes les mises à jour d'images soient terminées
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Extraire le HTML de l'éditeur (mise à jour après les uploads)
      if (this.editor && this.editor.editorElement) {
        this.template.content = this.editor.editorElement.innerHTML;
        console.log('📄 Contenu sauvegardé, images trouvées:', this.template.content.match(/<img[^>]*data-image-id[^>]*>/g)?.length || 0);
      }
      
      // Refactoriser avant sauvegarde
      const refactoredTemplate = this.refactorTemplate(this.template);
      refactoredTemplate.kind = 'word';
      
      const { templateApi } = await import('../shared/api/TemplateApi.js');
      const response = await templateApi.update(this.templateId, refactoredTemplate);
      
      if (response.success) {
        alert('Template enregistré avec succès');
      } else {
        alert('Erreur lors de l\'enregistrement: ' + (response.error || 'Erreur inconnue'));
      }
      
      return response;
    } catch (error) {
      console.error('❌ Erreur sauvegarde template:', error);
      alert('Erreur lors de la sauvegarde: ' + error.message);
      return { success: false, error: error.message };
    }
  }

  async saveTemplate() {
    return this.handleSave();
  }

  refactorTemplate(template) {
    // TODO: Implémenter le refactoring (fusion runs, nettoyage, etc.)
    // Pour l'instant, retourner le template tel quel
    return template;
  }
}

