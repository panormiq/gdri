// src/modules/editor/templateBuilder/components/rightPanel/RightPanel.js
import CollectionsTab from './CollectionsTab.js';
import SectionTab from './SectionTab.js';
import LayoutTab from './LayoutTab.js';
import ImageTab from './ImageTab.js';

// Charger le CSS
(function loadCSS() {
  if (!document.getElementById('right-panel-styles')) {
    const link = document.createElement('link');
    link.id = 'right-panel-styles';
    link.rel = 'stylesheet';
    const baseUrl = window.BASE_URL || '/';
    link.href = baseUrl + 'pages/modules/doc-template-v3/templateBuilder/components/rightPanel/RightPanel.css';
    document.head.appendChild(link);
  }
})();

export default class RightPanel {
  constructor({ template, onTemplateChange, onFieldDrop }) {
    this.template = template;
    this.onTemplateChange = onTemplateChange;
    this.onFieldDrop = onFieldDrop;
    this.currentTab = 'collections'; // collections, section, layout, image
    this.currentSectionId = null;
    
    this.collectionsTab = null;
    this.sectionTab = null;
    this.layoutTab = null;
    this.imageTab = null;
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
    
    const collectionsTab = document.createElement('button');
    collectionsTab.className = 'right-panel-tab active';
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
    
    const imageTab = document.createElement('button');
    imageTab.className = 'right-panel-tab';
    imageTab.textContent = 'Image';
    imageTab.onclick = () => this.switchTab('image');
    
    tabsContainer.appendChild(collectionsTab);
    tabsContainer.appendChild(sectionTab);
    tabsContainer.appendChild(layoutTab);
    tabsContainer.appendChild(imageTab);
    mainContainer.appendChild(tabsContainer);

    // Contenu des onglets (à droite)
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'right-panel-content';
    mainContainer.appendChild(this.contentContainer);

    this.container.appendChild(mainContainer);

    // Initialiser les onglets
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
    
    this.imageTab = new ImageTab({
      template: this.template,
      onTemplateChange: (changes) => this.onTemplateChange(changes)
    });

    // Afficher l'onglet par défaut
    this.switchTab('collections');
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    
    // Mettre à jour les boutons d'onglets
    const tabs = this.container.querySelectorAll('.right-panel-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    const tabButtons = this.container.querySelectorAll('.right-panel-tab');
    const tabIndex = ['collections', 'section', 'layout', 'image'].indexOf(tabName);
    if (tabButtons[tabIndex]) {
      tabButtons[tabIndex].classList.add('active');
    }

    // Afficher le contenu de l'onglet
    this.contentContainer.innerHTML = '';
    
    switch (tabName) {
      case 'collections':
        this.collectionsTab.render(this.contentContainer);
        break;
      case 'section':
        this.sectionTab.render(this.contentContainer);
        break;
      case 'layout':
        this.layoutTab.render(this.contentContainer);
        break;
      case 'image':
        this.imageTab.render(this.contentContainer);
        break;
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
    if (this.imageTab) {
      this.imageTab.setTemplate(template);
    }
  }
}

