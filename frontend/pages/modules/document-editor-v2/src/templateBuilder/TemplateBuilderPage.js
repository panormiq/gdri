// src/modules/editor/templateBuilder/TemplateBuilderPage.js
import Page from '../shared/components/page/Page.js';
import LeftPanel from './components/leftPanel/LeftPanel.js';
import RichTextEditor from './components/editor/RichTextEditor.js';
import RightPanel from './components/rightPanel/RightPanel.js';
import { extractStructureFromHTML } from './utils/templateRefactorer.js';
import { flattenSections } from './utils/sectionHierarchy.js';

// Charger le CSS
import loadCSS from '../utils/loadCSS.js';
loadCSS('templateBuilder/TemplateBuilderPage.css', 'template-builder-styles');

export default class TemplateBuilderPage extends Page {
  constructor(router, templateId = null) {
    super(router);
    this.templateId = templateId;
    this.template = null;
    this.leftPanel = null;
    this.editor = null;
    this.rightPanel = null;
  }

  async render(container) {
    container.innerHTML = '';

    // Header avec titre et bouton de sauvegarde
    const header = document.createElement('div');
    header.className = 'template-builder-header';
    
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'template-title-input';
    titleInput.placeholder = 'Nom du template';
    titleInput.value = this.template?.name || 'Nouveau Template';
    
    const saveButton = document.createElement('button');
    saveButton.className = 'template-save-button';
    saveButton.textContent = this.templateId ? 'Enregistrer' : 'Créer';
    saveButton.onclick = () => this.handleSave();
    
    header.appendChild(titleInput);
    header.appendChild(saveButton);
    container.appendChild(header);
    
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

    // Charger le template si templateId fourni
    if (this.templateId) {
      await this.loadTemplate();
      titleInput.value = this.template?.name || 'Nouveau Template';
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
    try {
      const { templateApi } = await import('../shared/api/TemplateApi.js');
      const response = await templateApi.getById(this.templateId);
      
      if (response.success && response.data) {
        this.template = response.data;
        // S'assurer que la structure existe
        if (!this.template.structure || !this.template.structure.sections) {
          this.template.structure = this.createDefaultTemplate().structure;
        }
        
        // Mettre à jour le champ titre si il existe
        if (this.titleInput) {
          this.titleInput.value = this.template.name || 'Nouveau Template';
        }
      } else {
        console.error('❌ Erreur chargement template:', response.error);
        this.template = this.createDefaultTemplate();
      }
    } catch (error) {
      console.error('❌ Erreur chargement template:', error);
      this.template = this.createDefaultTemplate();
    }
  }

  createDefaultTemplate() {
    return {
      name: 'Nouveau Template',
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
      onTitleLevelChanged: (sectionId, newLevel) => this.onTitleLevelChanged(sectionId, newLevel)
    });
    this.editor.render(centerContainer);
    
    // Si le template a du contenu sauvegardé, le charger dans l'éditeur après le rendu
    if (this.template.content) {
      setTimeout(() => {
        if (this.editor.setContent) {
          this.editor.setContent(this.template.content);
        } else if (this.editor.editorElement) {
          this.editor.editorElement.innerHTML = this.template.content;
        }
      }, 100);
    }

    // Initialiser le panneau droit
    const rightContainer = document.getElementById('template-builder-right');
    this.rightPanel = new RightPanel({
      template: this.template,
      onTemplateChange: (changes) => this.onTemplateChange(changes),
      onFieldDrop: (fieldPath) => this.onFieldDrop(fieldPath),
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
      }
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
      // Mettre à jour la structure directement (déjà hiérarchique)
      this.template.structure.sections = sections;
      
      // Re-render l'éditeur avec la nouvelle numérotation
      if (this.editor) {
        this.editor.renderAllSections();
      }
      
      // Mettre à jour le LeftPanel
      if (this.leftPanel) {
        this.leftPanel.setTemplate(this.template);
      }
      
      // Ne PAS appeler refactorTemplateFromHTML ici car cela écrase les changements du drag and drop
      // La structure est déjà correctement hiérarchique
    }
  }

  onContentChange(content) {
    // Mettre à jour le template avec le nouveau contenu
    // TODO: mettre à jour la section active
  }
  
  onTitleCreated(headingLevel) {
    // Créer une nouvelle section quand un titre est créé
    this.createSectionFromTitle(headingLevel);
  }
  
  onTitleLevelChanged(sectionId, newLevel) {
    // Changer le niveau d'une section existante
    this.changeSectionLevel(sectionId, newLevel);
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
    
    // Remonter dans la hiérarchie jusqu'à trouver un élément h1/h2/h3
    while (titleElement && titleElement !== this.editor.editorElement) {
      if (titleElement.tagName && titleElement.tagName.match(/^H[1-3]$/i)) {
        break;
      }
      titleElement = titleElement.parentElement;
    }
    
    // Vérifier si on a trouvé un titre
    if (!titleElement || !titleElement.tagName || !titleElement.tagName.match(/^H[1-3]$/i)) {
      console.warn('⚠️ Titre non trouvé après création');
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
    }
    
    // Recréer le JSON depuis le HTML pour éviter les pertes et reconstruire la hiérarchie
    // La structure hiérarchique sera reconstruite automatiquement depuis le HTML
    this.refactorTemplateFromHTML();
    
    // Re-render pour régénérer la numérotation
    if (this.editor) {
      this.editor.renderAllSections();
    }
    
    // Mettre à jour le LeftPanel
    if (this.leftPanel) {
      this.leftPanel.setTemplate(this.template);
    }
    
    console.log('✅ Nouvelle section créée:', { id: sectionId, level: parseInt(headingLevel.charAt(1)), title: titleText });
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
    
    // Appliquer les styles de mise en page à l'éditeur
    if (this.editor && changes.generalStyles) {
      this.editor.applyLayoutStyles();
      
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
      
      const { templateApi } = await import('../shared/api/TemplateApi.js');
      let response;
      
      if (this.templateId) {
        response = await templateApi.update(this.templateId, refactoredTemplate);
        if (response.success) {
          alert('Template enregistré avec succès');
        } else {
          alert('Erreur lors de l\'enregistrement: ' + (response.error || 'Erreur inconnue'));
        }
      } else {
        response = await templateApi.create(refactoredTemplate);
        if (response.success && response.data._id) {
          this.templateId = response.data._id;
          // Mettre à jour l'URL pour refléter le nouvel ID
          if (this.router) {
            this.router.navigate(`/templates/edit/${this.templateId}`);
          }
          // Mettre à jour le bouton
          const saveButton = document.querySelector('.template-save-button');
          if (saveButton) {
            saveButton.textContent = 'Enregistrer';
          }
          alert('Template créé avec succès');
        } else {
          alert('Erreur lors de la création: ' + (response.error || 'Erreur inconnue'));
        }
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

