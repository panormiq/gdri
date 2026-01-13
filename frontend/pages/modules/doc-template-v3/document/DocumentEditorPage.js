// front/src/modules/editor/document/DocumentEditorPage.js
import Page from '../shared/components/page/Page.js';
import RichTextEditor from '../templateBuilder/components/editor/RichTextEditor.js';
import LeftPanel from '../templateBuilder/components/leftPanel/LeftPanel.js';
import FormatTab from '../templateBuilder/components/rightPanel/FormatTab.js';
import SectionTab from '../templateBuilder/components/rightPanel/SectionTab.js';
import LayoutTab from '../templateBuilder/components/rightPanel/LayoutTab.js';
import { buildHierarchy } from '../templateBuilder/utils/sectionHierarchy.js';
import { documentApi } from '../shared/api/DocumentApi.js';

// Charger le CSS
(function loadCSS() {
  if (!document.getElementById('document-editor-styles')) {
    const link = document.createElement('link');
    link.id = 'document-editor-styles';
    link.rel = 'stylesheet';
    const baseUrl = window.BASE_URL || '/';
    link.href = baseUrl + 'pages/modules/doc-template-v3/document/DocumentEditorPage.css';
    document.head.appendChild(link);
  }
})();

export default class DocumentEditorPage extends Page {
  constructor(router, documentId) {
    super(router);
    this.documentId = documentId;
    this.document = null;
    this.editor = null;
    this.leftPanel = null;
    this.rightPanel = null;
  }

  async render(container) {
    container.innerHTML = '';

    // Afficher un indicateur de chargement
    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = 'padding: 2rem; text-align: center;';
    loadingDiv.innerHTML = '<p>Chargement du document...</p>';
    container.appendChild(loadingDiv);

    try {
      // Charger le document
      const res = await documentApi.getById(this.documentId);
      if (!res.success) {
        container.innerHTML = `
          <div style="padding: 2rem; text-align: center;">
            <h2>Erreur de chargement</h2>
            <p style="color: #d32f2f;">${res.error || 'Document non trouvé'}</p>
            <p>ID du document: <code>${this.documentId}</code></p>
            <a href="${this.router.basePath || '/'}/documents" data-link style="display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: #1976d2; color: white; text-decoration: none; border-radius: 4px;">Retour à la liste</a>
          </div>
        `;
        return;
      }

      this.document = res.data;
      
      // Retirer l'indicateur de chargement
      container.innerHTML = '';
    } catch (error) {
      console.error('❌ Erreur lors du chargement du document:', error);
      container.innerHTML = `
        <div style="padding: 2rem; text-align: center;">
          <h2>Erreur lors du chargement</h2>
          <p style="color: #d32f2f;">${error.message || 'Erreur inconnue'}</p>
          <details style="margin-top: 1rem; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
            <summary style="cursor: pointer; color: #666;">Détails techniques</summary>
            <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; margin-top: 0.5rem;">${error.stack || 'Pas de stack trace disponible'}</pre>
          </details>
          <a href="${this.router.basePath || '/'}/documents" data-link style="display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: #1976d2; color: white; text-decoration: none; border-radius: 4px;">Retour à la liste</a>
        </div>
      `;
      return;
    }

    // Header avec titre et actions
    const header = document.createElement('div');
    header.className = 'document-editor-header';
    
    const title = document.createElement('h1');
    title.textContent = this.document.name;
    header.appendChild(title);
    
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'document-editor-actions';

    // Bouton Enregistrer
    const saveButton = document.createElement('button');
    saveButton.className = 'btn btn-primary';
    saveButton.textContent = '💾 Enregistrer';
    saveButton.onclick = () => this.handleSave();
    actionsContainer.appendChild(saveButton);

    // Bouton Exporter PDF
    const exportPdfButton = document.createElement('button');
    exportPdfButton.className = 'btn btn-secondary';
    exportPdfButton.textContent = '📥 Exporter PDF';
    exportPdfButton.onclick = () => this.exportPdf();
    actionsContainer.appendChild(exportPdfButton);

    header.appendChild(actionsContainer);
    container.appendChild(header);
    
    // Container principal avec 3 colonnes (TOC + éditeur + panel droit)
    const editorContainer = document.createElement('div');
    editorContainer.className = 'document-editor-container';

    // Colonne gauche (TOC)
    const leftColumn = document.createElement('div');
    leftColumn.className = 'document-editor-left';
    leftColumn.id = 'document-editor-left';

    // Colonne centrale (éditeur)
    const centerColumn = document.createElement('div');
    centerColumn.className = 'document-editor-center';
    centerColumn.id = 'document-editor-center';

    // Colonne droite (panel format)
    const rightColumn = document.createElement('div');
    rightColumn.className = 'document-editor-right';
    rightColumn.id = 'document-editor-right';

    editorContainer.appendChild(leftColumn);
    editorContainer.appendChild(centerColumn);
    editorContainer.appendChild(rightColumn);
    container.appendChild(editorContainer);

    // Initialiser les composants
    this.initComponents();
  }

  initComponents() {
    // Créer un template minimal pour l'éditeur (il a besoin d'une structure)
    const templateForEditor = {
      name: this.document.name,
      content: this.document.content || '',
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
        }
      },
      structure: {
        sections: []
      }
    };

    // Initialiser le panneau gauche (TOC)
    const leftColumn = document.getElementById('document-editor-left');
    console.log('🔍 Initialisation LeftPanel, container:', leftColumn);
    
    if (!leftColumn) {
      console.error('❌ Container document-editor-left non trouvé');
    } else {
      this.leftPanel = new LeftPanel({
        template: templateForEditor,
        onSectionSelect: (sectionId) => {
          if (this.editor && this.editor.scrollToSection) {
            this.editor.scrollToSection(sectionId);
          }
        },
        onSectionReorder: () => {
          // Pas de réordonnancement en mode document
        }
      });
      this.leftPanel.render(leftColumn);
      console.log('✅ LeftPanel rendu dans:', leftColumn);
    }
    
    // Initialiser l'éditeur central
    const centerColumn = document.getElementById('document-editor-center');
    this.editor = new RichTextEditor({
      template: templateForEditor,
      onContentChange: () => {
        // Le contenu a changé - mettre à jour le TOC si nécessaire
        this.updateTOC();
      },
      onTitleCreated: () => {
        this.updateTOC();
      },
      onSectionChange: (sectionId) => {
        // Mettre à jour la sélection dans le TOC
        if (this.leftPanel && this.leftPanel.selectSection) {
          this.leftPanel.selectSection(sectionId, false); // false = ne pas notifier (éviter boucle)
        }
      },
      onTitleLevelChanged: () => {
        this.updateTOC();
      }
    });
    this.editor.render(centerColumn);
    
    // Charger le contenu HTML du document après le rendu
    // Le RichTextEditor appelle renderAllSections() qui vide l'éditeur si structure vide
    // On doit charger le contenu après que renderAllSections() ait été appelé
    // Utiliser requestAnimationFrame pour s'assurer que le DOM est prêt
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (this.editor && this.editor.editorElement) {
          console.log('📝 Chargement du contenu du document dans l\'éditeur');
          // Si le document a du contenu, le charger directement
          if (this.document.content && this.document.content.trim()) {
            this.editor.editorElement.innerHTML = this.document.content;
            console.log('✅ Contenu chargé:', this.document.content.substring(0, 100));
            
            // Mettre à jour le TOC après chargement (avec un délai supplémentaire pour que le DOM soit prêt)
            setTimeout(() => {
              this.updateTOC();
            }, 200);
          } else {
            // Sinon, ajouter un paragraphe vide pour permettre l'édition
            this.editor.editorElement.innerHTML = '<p><br></p>';
            console.log('📝 Éditeur initialisé avec paragraphe vide');
          }
        } else {
          console.error('❌ Éditeur non initialisé correctement', {
            editor: this.editor,
            editorElement: this.editor?.editorElement
          });
        }
      }, 100);
    });

    // Initialiser le panel droit (sans onglet Collections)
    const rightColumn = document.getElementById('document-editor-right');
    this.initRightPanel(rightColumn);
  }

  updateTOC() {
    // Extraire la structure depuis le HTML de l'éditeur pour mettre à jour le TOC
    if (!this.editor || !this.editor.editorElement || !this.leftPanel) {
      console.log('⚠️ updateTOC: éléments manquants', {
        editor: !!this.editor,
        editorElement: !!this.editor?.editorElement,
        leftPanel: !!this.leftPanel
      });
      return;
    }
    
    // Extraire les sections depuis le HTML
    const headings = this.editor.editorElement.querySelectorAll('h1, h2, h3');
    console.log('🔍 updateTOC: headings trouvés', headings.length);
    
    const flatSections = [];
    
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      // Extraire le titre (sans la numérotation si elle existe)
      let titleText = heading.textContent.trim();
      // Retirer la numérotation hiérarchique au début (format: "1.1. ", "1.2. ", etc.)
      titleText = titleText.replace(/^[\d\w\.]+\s+/, '').trim();
      // Si après le remplacement il ne reste rien, garder le texte original
      if (!titleText || titleText.length < 2) {
        titleText = heading.textContent.trim();
      }
      
      const sectionId = heading.dataset.sectionId || `section-${Date.now()}-${index}`;
      
      flatSections.push({
        id: sectionId,
        type: 'section',
        level: level,
        title: titleText || 'Sans titre',
        visibleInTOC: true,
        paragraphs: [],
        sections: []
      });
    });
    
    console.log('📋 updateTOC: sections extraites', flatSections);
    
    // Construire la hiérarchie depuis la liste plate
    const hierarchicalSections = buildHierarchy(flatSections);
    
    // Mettre à jour le template pour le TOC
    if (this.editor.template) {
      this.editor.template.structure = {
        sections: hierarchicalSections
      };
      
      console.log('✅ updateTOC: hiérarchie construite', hierarchicalSections);
      
      // Mettre à jour le LeftPanel
      if (this.leftPanel) {
        this.leftPanel.template = this.editor.template;
        this.leftPanel.renderSections();
        console.log('✅ updateTOC: LeftPanel mis à jour');
      }
    }
  }

  initRightPanel(container) {
    container.className = 'document-editor-right-panel';
    container.innerHTML = '';

    // Container flex pour onglets verticaux + contenu
    const mainContainer = document.createElement('div');
    mainContainer.className = 'right-panel-main';

    // Onglets verticaux (à gauche)
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'right-panel-tabs';
    
    const formatTab = document.createElement('button');
    formatTab.className = 'right-panel-tab active';
    formatTab.textContent = 'Format';
    formatTab.onclick = () => this.switchTab('format', tabsContainer, contentContainer);
    
    const sectionTab = document.createElement('button');
    sectionTab.className = 'right-panel-tab';
    sectionTab.textContent = 'Section';
    sectionTab.onclick = () => this.switchTab('section', tabsContainer, contentContainer);
    
    const layoutTab = document.createElement('button');
    layoutTab.className = 'right-panel-tab';
    layoutTab.textContent = 'Mise en page';
    layoutTab.onclick = () => this.switchTab('layout', tabsContainer, contentContainer);
    
    tabsContainer.appendChild(formatTab);
    tabsContainer.appendChild(sectionTab);
    tabsContainer.appendChild(layoutTab);
    mainContainer.appendChild(tabsContainer);

    // Contenu des onglets (à droite)
    const contentContainer = document.createElement('div');
    contentContainer.className = 'right-panel-content';
    mainContainer.appendChild(contentContainer);

    container.appendChild(mainContainer);

    // Initialiser les onglets
    this.formatTab = new FormatTab({
      onFormat: (command, value) => {
        if (this.editor && this.editor.editorElement) {
          document.execCommand(command, false, value);
          this.editor.editorElement.focus();
        }
      }
    });
    
    this.sectionTab = new SectionTab({
      template: { structure: {} },
      currentSectionId: null,
      onSectionChange: () => {}
    });
    
    this.layoutTab = new LayoutTab({
      template: { generalStyles: {} },
      onTemplateChange: () => {}
    });

    // Afficher l'onglet format par défaut
    this.switchTab('format', tabsContainer, contentContainer);
  }

  switchTab(tabName, tabsContainer, contentContainer) {
    // Mettre à jour les onglets actifs
    tabsContainer.querySelectorAll('.right-panel-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    tabsContainer.querySelectorAll('.right-panel-tab')[['format', 'section', 'layout'].indexOf(tabName)].classList.add('active');

    // Afficher le contenu de l'onglet
    contentContainer.innerHTML = '';
    
    if (tabName === 'format') {
      this.formatTab.render(contentContainer);
    } else if (tabName === 'section') {
      this.sectionTab.render(contentContainer);
    } else if (tabName === 'layout') {
      this.layoutTab.render(contentContainer);
    }
  }

  async handleSave() {
    try {
      // Extraire le HTML de l'éditeur
      let content = '';
      if (this.editor && this.editor.editorElement) {
        content = this.editor.editorElement.innerHTML;
      }

      // Mettre à jour le document
      const res = await documentApi.update(this.documentId, {
        content: content
      });

      if (res.success) {
        alert('Document enregistré avec succès');
        this.document.content = content;
      } else {
        alert('Erreur lors de l\'enregistrement: ' + (res.error || 'Erreur inconnue'));
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde document:', error);
      alert('Erreur lors de la sauvegarde: ' + error.message);
    }
  }

  async exportPdf() {
    try {
      // Sauvegarder d'abord
      await this.handleSave();
      
      // Télécharger le PDF
      const res = await documentApi.downloadPdf(this.documentId, `${this.document.name}.pdf`);
      if (!res.success) {
        alert('Erreur lors de l\'export: ' + (res.error || 'Erreur inconnue'));
      }
    } catch (error) {
      console.error('❌ Erreur export PDF:', error);
      alert('Erreur lors de l\'export: ' + error.message);
    }
  }
}

