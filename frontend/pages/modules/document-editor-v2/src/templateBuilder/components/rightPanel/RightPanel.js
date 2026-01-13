// src/modules/editor/templateBuilder/components/rightPanel/RightPanel.js
import FormatTab from './FormatTab.js';
import CollectionsTab from './CollectionsTab.js';
import SectionTab from './SectionTab.js';
import LayoutTab from './LayoutTab.js';

// Charger le CSS
import loadCSS from '../../../utils/loadCSS.js';
loadCSS('templateBuilder/components/rightPanel/RightPanel.css', 'right-panel-styles');

export default class RightPanel {
  constructor({ template, onTemplateChange, onFieldDrop, onFormat }) {
    this.template = template;
    this.onTemplateChange = onTemplateChange;
    this.onFieldDrop = onFieldDrop;
    this.onFormatCallback = onFormat; // Callback pour appeler l'éditeur directement
    this.currentTab = 'format'; // format, collections, section, layout
    this.currentSectionId = null;
    
    this.formatTab = null;
    this.collectionsTab = null;
    this.sectionTab = null;
    this.layoutTab = null;
  }

  render(container) {
    this.container = container;
    this.container.className = 'right-panel';
    this.container.innerHTML = '';

    // Container flex pour onglets verticaux + contenu
    const mainContainer = document.createElement('div');
    mainContainer.className = 'right-panel-main';

    // Onglets verticaux (à gauche)
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'right-panel-tabs';
    
    const formatTab = document.createElement('button');
    formatTab.className = 'right-panel-tab active';
    formatTab.textContent = 'Format';
    formatTab.onclick = () => this.switchTab('format');
    
    const collectionsTab = document.createElement('button');
    collectionsTab.className = 'right-panel-tab';
    collectionsTab.textContent = 'Collections';
    collectionsTab.onclick = () => this.switchTab('collections');
    
    const sectionTab = document.createElement('button');
    sectionTab.className = 'right-panel-tab';
    sectionTab.textContent = 'Section';
    sectionTab.onclick = () => this.switchTab('section');
    
    const layoutTab = document.createElement('button');
    layoutTab.className = 'right-panel-tab';
    layoutTab.textContent = 'Mise en page';
    layoutTab.onclick = () => this.switchTab('layout');
    
    tabsContainer.appendChild(formatTab);
    tabsContainer.appendChild(collectionsTab);
    tabsContainer.appendChild(sectionTab);
    tabsContainer.appendChild(layoutTab);
    mainContainer.appendChild(tabsContainer);

    // Contenu des onglets (à droite)
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'right-panel-content';
    mainContainer.appendChild(this.contentContainer);

    this.container.appendChild(mainContainer);

    // Initialiser les onglets
    this.formatTab = new FormatTab({
      onFormat: (command, value) => this.onFormat(command, value)
    });
    
    // La référence à l'éditeur sera définie après (via setEditor)
    
    this.collectionsTab = new CollectionsTab({
      template: this.template,
      onFieldDrop: this.onFieldDrop,
      onTemplateChange: (changes) => this.onTemplateChange(changes)
    });
    
    this.sectionTab = new SectionTab({
      template: this.template,
      currentSectionId: this.currentSectionId,
      onSectionChange: (changes) => this.onSectionChange(changes)
    });
    
    this.layoutTab = new LayoutTab({
      template: this.template,
      onTemplateChange: (changes) => this.onTemplateChange(changes)
    });

    // Afficher l'onglet par défaut
    this.switchTab('format');
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    
    // Mettre à jour les boutons d'onglets
    const tabs = this.container.querySelectorAll('.right-panel-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    const tabButtons = this.container.querySelectorAll('.right-panel-tab');
    const tabIndex = ['format', 'collections', 'section', 'layout'].indexOf(tabName);
    if (tabButtons[tabIndex]) {
      tabButtons[tabIndex].classList.add('active');
    }

    // Afficher le contenu de l'onglet
    this.contentContainer.innerHTML = '';
    
    switch (tabName) {
      case 'format':
        this.formatTab.render(this.contentContainer);
        break;
      case 'collections':
        this.collectionsTab.render(this.contentContainer);
        break;
      case 'section':
        this.sectionTab.render(this.contentContainer);
        break;
      case 'layout':
        this.layoutTab.render(this.contentContainer);
        break;
    }
  }

  onFormat(command, value) {
    console.log('🔘 RightPanel.onFormat appelé:', command, value);
    
    // Appeler directement le callback si disponible
    if (this.onFormatCallback) {
      console.log('✅ Appel du callback onFormatCallback');
      this.onFormatCallback(command, value);
    } else {
      console.warn('⚠️ onFormatCallback non défini, émission d\'événement custom');
      // Fallback : émettre un événement custom
      const event = new CustomEvent('editor-format', {
        detail: { command, value }
      });
      document.dispatchEvent(event);
    }
  }

  onSectionChange(changes) {
    if (this.onTemplateChange) {
      this.onTemplateChange(changes);
    }
  }

  setCurrentSection(sectionId) {
    this.currentSectionId = sectionId;
    if (this.sectionTab) {
      this.sectionTab.setCurrentSection(sectionId);
      if (this.currentTab === 'section') {
        this.sectionTab.render(this.contentContainer);
      }
    }
  }

  setTemplate(template) {
    this.template = template;
    if (this.collectionsTab) {
      this.collectionsTab.setTemplate(template);
    }
    if (this.sectionTab) {
      this.sectionTab.setTemplate(template);
    }
  }
}

