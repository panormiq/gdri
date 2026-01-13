console.log('📄 FICHIER CHARGÉ: app.js');

/**
 * WYSIWYG App - Application principale
 * Coordonne les composants Editor, TOC et Sidebar
 */

import { Editor } from './components/Editor.js';
import { TOC } from './components/Toc.js';
import { Sidebar } from './components/Sidebar.js';

export class WysiwygApp {
  constructor({ tocEl, editorEl, sidebarEl, contentJson, styleJson, orientation = "portrait" }) {
    console.log('🚀 WYSIWYG APP - Initialisation');
    console.log('📦 Éléments reçus:', {
      tocEl: tocEl,
      editorEl: editorEl,
      sidebarEl: sidebarEl,
      hasContent: !!contentJson
    });
    
    this.content = contentJson;
    this.style = styleJson || {};
    this.orientation = orientation;

    // Initialiser les composants
    console.log('📝 Création de l\'éditeur...');
    this.editor = new Editor(editorEl);
    console.log('📑 Création du TOC...');
    this.toc = new TOC(tocEl);
    console.log('🔧 Création de la Sidebar...');
    this.sidebar = new Sidebar(sidebarEl, this.editor);
    console.log('✅ Tous les composants créés');

    // Interactions entre composants
    this.setupInteractions();

    // Initialiser l'affichage
    this.init();
  }

  setupInteractions() {
    // Interaction Sidebar → Editor
    // (gérée directement dans Sidebar via FormatUtils)

    // Interaction TOC → Editor
    this.toc.onSectionClick = (sectionId) => {
      this.editor.scrollToSection(sectionId);
      this.toc.highlightSection(sectionId);
    };

    // Interaction Editor → TOC (mise à jour du contenu)
    this.editor.onContentChange = () => {
      // Mettre à jour la numérotation dans le TOC
      this.updateTOC();
    };

    // Synchroniser le highlight lors du scroll
    this.setupScrollSync();
  }

  setupScrollSync() {
    // Détecter quelle section est visible lors du scroll
    if (this.editor && this.editor.container) {
      this.editor.container.addEventListener('scroll', () => {
        this.updateActiveSection();
      });
    }
  }

  updateActiveSection() {
    // Trouver la section actuellement visible
    const sections = this.editor.container.querySelectorAll('.wysiwyg-section');
    let activeSectionId = null;

    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      const editorRect = this.editor.container.getBoundingClientRect();
      
      // Si la section est visible dans la zone d'édition
      if (rect.top >= editorRect.top && rect.top <= editorRect.top + 100) {
        activeSectionId = section.dataset.sectionId;
      }
    });

    if (activeSectionId) {
      this.toc.highlightSection(activeSectionId);
    }
  }

  init() {
    this.renderSections();
    this.applyPageSize();
    this.updateTOC();
  }

  renderSections() {
    this.editor.renderSections(this.content.sections);
  }

  updateTOC() {
    // Calculer la numérotation
    const sections = this.editor.container.querySelectorAll('.wysiwyg-section');
    const numbering = this.editor.calculateNumbering(sections);
    
    // Mettre à jour le TOC avec la numérotation
    // Passer le contenu original pour préserver la structure hiérarchique
    this.toc.render(this.content.sections || this.content, numbering);
  }

  applyPageSize() {
    const pxPerCm = 37.795275591;
    const A4 = { width: 21, height: 29.7 }; // cm

    const width = this.orientation === "portrait" ? A4.width * pxPerCm : A4.height * pxPerCm;
    const height = this.orientation === "portrait" ? A4.height * pxPerCm : A4.width * pxPerCm;

    this.editor.setPageSize(width, height);
  }

  changeOrientation() {
    this.orientation = this.orientation === "portrait" ? "paysage" : "portrait";
    this.applyPageSize();
  }

  getContent() {
    return this.editor.getContent();
  }

  saveContent() {
    const content = this.getContent();
    // Ici, on pourrait envoyer le contenu au serveur
    console.log('💾 Contenu sauvegardé:', content);
    return content;
  }
}

// Export des classes pour compatibilité
export { Editor } from './components/Editor.js';
export { TOC } from './components/Toc.js';
export { Sidebar } from './components/Sidebar.js';
