// src/modules/editor/templateBuilder/components/rightPanel/SectionTab.js

// Charger le CSS
(function loadCSS() {
  if (!document.getElementById('section-tab-styles')) {
    const link = document.createElement('link');
    link.id = 'section-tab-styles';
    link.rel = 'stylesheet';
    const baseUrl = window.BASE_URL || '/';
    link.href = baseUrl + 'pages/modules/doc-template-v3/templateBuilder/components/rightPanel/SectionTab.css';
    document.head.appendChild(link);
  }
})();

export default class SectionTab {
  constructor({ template, currentSectionId, onSectionChange }) {
    this.template = template;
    this.currentSectionId = currentSectionId;
    this.onSectionChange = onSectionChange;
  }

  render(container) {
    this.container = container;
    this.container.className = 'section-tab';
    this.container.innerHTML = '';

    if (!this.currentSectionId) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'Sélectionnez une section pour voir ses propriétés';
      emptyMsg.className = 'empty-message';
      this.container.appendChild(emptyMsg);
      return;
    }

    // Trouver la section
    const section = this.findSection(this.template?.structure, this.currentSectionId);
    if (!section) {
      const errorMsg = document.createElement('p');
      errorMsg.textContent = 'Section non trouvée';
      errorMsg.className = 'error-message';
      this.container.appendChild(errorMsg);
      return;
    }

    // Titre
    const title = document.createElement('h3');
    title.textContent = 'Propriétés de la section';
    this.container.appendChild(title);

    // Champ titre
    const titleGroup = document.createElement('div');
    titleGroup.className = 'section-field';

    const titleLabel = document.createElement('label');
    titleLabel.textContent = 'Titre :';
    titleGroup.appendChild(titleLabel);

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'section-title-input';
    titleInput.value = section.title || '';
    titleInput.placeholder = 'Titre de la section';
    
    titleInput.oninput = () => {
      section.title = titleInput.value;
      if (this.onSectionChange) {
        this.onSectionChange({ section });
      }
    };
    
    titleGroup.appendChild(titleInput);
    this.container.appendChild(titleGroup);

    // Checkbox TOC
    const tocGroup = document.createElement('div');
    tocGroup.className = 'section-field';

    const tocLabel = document.createElement('label');
    tocLabel.className = 'section-checkbox-label';
    
    const tocCheckbox = document.createElement('input');
    tocCheckbox.type = 'checkbox';
    tocCheckbox.className = 'section-toc-checkbox';
    tocCheckbox.checked = section.visibleInTOC !== false; // true par défaut
    
    tocCheckbox.onchange = () => {
      section.visibleInTOC = tocCheckbox.checked;
      if (this.onSectionChange) {
        this.onSectionChange({ section });
      }
    };
    
    tocLabel.appendChild(tocCheckbox);
    tocLabel.appendChild(document.createTextNode(' Afficher dans le TOC'));
    tocGroup.appendChild(tocLabel);
    this.container.appendChild(tocGroup);

    // Niveau (optionnel)
    const levelGroup = document.createElement('div');
    levelGroup.className = 'section-field';

    const levelLabel = document.createElement('label');
    levelLabel.textContent = 'Niveau TOC :';
    levelGroup.appendChild(levelLabel);

    const levelInput = document.createElement('input');
    levelInput.type = 'number';
    levelInput.className = 'section-level-input';
    levelInput.min = '1';
    levelInput.max = '6';
    levelInput.value = section.level || 1;
    
    levelInput.onchange = () => {
      section.level = parseInt(levelInput.value) || 1;
      if (this.onSectionChange) {
        this.onSectionChange({ section });
      }
    };
    
    levelGroup.appendChild(levelInput);
    this.container.appendChild(levelGroup);
  }

  findSection(structure, sectionId) {
    if (!structure || !structure.sections) return null;

    for (const section of structure.sections) {
      if (section.id === sectionId) {
        return section;
      }
      if (section.sections && section.sections.length > 0) {
        const found = this.findSection({ sections: section.sections }, sectionId);
        if (found) return found;
      }
    }
    return null;
  }

  setCurrentSection(sectionId) {
    this.currentSectionId = sectionId;
    if (this.container) {
      this.render(this.container);
    }
  }

  setTemplate(template) {
    this.template = template;
    if (this.container && this.currentSectionId) {
      this.render(this.container);
    }
  }
}

