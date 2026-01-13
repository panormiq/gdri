// src/modules/editor/templateBuilder/components/rightPanel/LayoutTab.js

// Charger le CSS
import loadCSS from '../../../utils/loadCSS.js';
loadCSS('templateBuilder/components/rightPanel/LayoutTab.css', 'layout-tab-styles');

export default class LayoutTab {
  constructor({ template, onTemplateChange }) {
    this.template = template;
    this.onTemplateChange = onTemplateChange;
    this.expandedHeadings = {
      h1: false,
      h2: false,
      h3: false
    };
  }

  render(container) {
    this.container = container;
    this.container.className = 'layout-tab';
    this.container.innerHTML = '';

    // Titre
    const title = document.createElement('h3');
    title.textContent = 'Mise en page';
    this.container.appendChild(title);

    // Section : Numérotation
    this.createNumberingSection();

    // Section : Padding/Margin
    this.createSpacingSection();

    // Section : Font globale
    this.createFontSection();

    // Section : Titres
    this.createHeadingsSection();
  }

  createNumberingSection() {
    const section = document.createElement('div');
    section.className = 'layout-section';

    const sectionTitle = document.createElement('h4');
    sectionTitle.textContent = 'Numérotation';
    section.appendChild(sectionTitle);

    // Sélecteur de type de numérotation
    const numberingGroup = document.createElement('div');
    numberingGroup.className = 'layout-field';

    const label = document.createElement('label');
    label.textContent = 'Type :';
    numberingGroup.appendChild(label);

    const select = document.createElement('select');
    select.className = 'layout-select';
    select.innerHTML = `
      <option value="numeric">1. 2. 3. (Numérique)</option>
      <option value="alpha">a. b. c. (Alpha minuscule)</option>
      <option value="alphaUpper">A. B. C. (Alpha majuscule)</option>
      <option value="roman">i. ii. iii. (Romain minuscule)</option>
      <option value="romanUpper">I. II. III. (Romain majuscule)</option>
      <option value="custom">Personnalisé</option>
    `;
    
    // Récupérer le type actuel
    const currentType = this.template?.generalStyles?.numbering?.type || 'numeric';
    select.value = currentType;

    numberingGroup.appendChild(select);
    section.appendChild(numberingGroup);

    // Champ personnalisé (si type = custom)
    const customGroup = document.createElement('div');
    customGroup.className = 'layout-field';
    customGroup.style.display = currentType === 'custom' ? 'block' : 'none';

    const customLabel = document.createElement('label');
    customLabel.textContent = 'Format personnalisé :';
    customGroup.appendChild(customLabel);

    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.className = 'layout-input';
    customInput.placeholder = 'Ex: Section {n}';
    customInput.value = this.template?.generalStyles?.numbering?.custom || '{n}.';

    customGroup.appendChild(customInput);
    section.appendChild(customGroup);

    // Gestion du changement de type et du format personnalisé
    select.onchange = () => {
      customGroup.style.display = select.value === 'custom' ? 'block' : 'none';
      if (!this.template.generalStyles) {
        this.template.generalStyles = {};
      }
      if (!this.template.generalStyles.numbering) {
        this.template.generalStyles.numbering = {};
      }
      this.template.generalStyles.numbering.type = select.value;
      if (this.onTemplateChange) {
        this.onTemplateChange({ generalStyles: this.template.generalStyles });
      }
    };

    customInput.onchange = () => {
      if (!this.template.generalStyles.numbering) {
        this.template.generalStyles.numbering = {};
      }
      this.template.generalStyles.numbering.custom = customInput.value;
      if (this.onTemplateChange) {
        this.onTemplateChange({ generalStyles: this.template.generalStyles });
      }
    };

    this.container.appendChild(section);
  }

  createSpacingSection() {
    const section = document.createElement('div');
    section.className = 'layout-section';

    const sectionTitle = document.createElement('h4');
    sectionTitle.textContent = 'Espacements';
    section.appendChild(sectionTitle);

    // Padding
    this.createSpacingFields(section, 'Padding', 'padding', [
      { label: 'Gauche', key: 'left' },
      { label: 'Droite', key: 'right' },
      { label: 'Haut', key: 'top' },
      { label: 'Bas', key: 'bottom' }
    ]);

    // Margin
    this.createSpacingFields(section, 'Marge', 'margin', [
      { label: 'Gauche', key: 'left' },
      { label: 'Droite', key: 'right' },
      { label: 'Haut', key: 'top' },
      { label: 'Bas', key: 'bottom' }
    ]);

    this.container.appendChild(section);
  }

  createSpacingFields(parent, title, type, fields) {
    const group = document.createElement('div');
    group.className = 'layout-field-group';

    const groupTitle = document.createElement('label');
    groupTitle.textContent = title + ' :';
    group.appendChild(groupTitle);

    const inputsContainer = document.createElement('div');
    inputsContainer.className = 'layout-inputs-row';

    fields.forEach(field => {
      const fieldGroup = document.createElement('div');
      fieldGroup.className = 'layout-field-inline';

      const label = document.createElement('label');
      label.textContent = field.label + ' :';
      label.style.fontSize = '0.9em';
      fieldGroup.appendChild(label);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'layout-input-small';
      input.placeholder = '0';
      
      const value = this.template?.generalStyles?.default?.[type]?.[field.key] || '';
      input.value = value;

      input.onchange = () => {
        if (!this.template.generalStyles) {
          this.template.generalStyles = {};
        }
        if (!this.template.generalStyles.default) {
          this.template.generalStyles.default = {};
        }
        if (!this.template.generalStyles.default[type]) {
          this.template.generalStyles.default[type] = {};
        }
        this.template.generalStyles.default[type][field.key] = input.value;
        if (this.onTemplateChange) {
          this.onTemplateChange({ generalStyles: this.template.generalStyles });
        }
      };

      fieldGroup.appendChild(input);
      inputsContainer.appendChild(fieldGroup);
    });

    group.appendChild(inputsContainer);
    parent.appendChild(group);
  }

  createFontSection() {
    const section = document.createElement('div');
    section.className = 'layout-section';

    const sectionTitle = document.createElement('h4');
    sectionTitle.textContent = 'Police globale';
    section.appendChild(sectionTitle);

    // Famille de police
    const fontFamilyGroup = this.createField('Famille :', 'select', {
      options: [
        'Arial',
        'Times New Roman',
        'Courier New',
        'Verdana',
        'Georgia',
        'Helvetica',
        'Comic Sans MS',
        'Trebuchet MS'
      ],
      value: this.template?.generalStyles?.default?.fontFamily || 'Arial',
      onChange: (value) => {
        if (!this.template.generalStyles.default) {
          this.template.generalStyles.default = {};
        }
        this.template.generalStyles.default.fontFamily = value;
        if (this.onTemplateChange) {
          this.onTemplateChange({ generalStyles: this.template.generalStyles });
        }
      }
    });
    section.appendChild(fontFamilyGroup);

    // Taille de police
    const fontSizeGroup = this.createField('Taille :', 'number', {
      value: this.template?.generalStyles?.default?.fontSize || 12,
      min: 8,
      max: 72,
      onChange: (value) => {
        if (!this.template.generalStyles.default) {
          this.template.generalStyles.default = {};
        }
        this.template.generalStyles.default.fontSize = parseInt(value);
        if (this.onTemplateChange) {
          this.onTemplateChange({ generalStyles: this.template.generalStyles });
        }
      }
    });
    section.appendChild(fontSizeGroup);

    // Couleur
    const colorGroup = this.createField('Couleur :', 'color', {
      value: this.template?.generalStyles?.default?.color || '#000000',
      onChange: (value) => {
        if (!this.template.generalStyles.default) {
          this.template.generalStyles.default = {};
        }
        this.template.generalStyles.default.color = value;
        if (this.onTemplateChange) {
          this.onTemplateChange({ generalStyles: this.template.generalStyles });
        }
      }
    });
    section.appendChild(colorGroup);

    this.container.appendChild(section);
  }

  createHeadingsSection() {
    const section = document.createElement('div');
    section.className = 'layout-section';

    const sectionTitle = document.createElement('h4');
    sectionTitle.textContent = 'Titres';
    section.appendChild(sectionTitle);

    // H1, H2, H3 avec sous-menus dépliables
    ['h1', 'h2', 'h3'].forEach(heading => {
      this.createHeadingSubmenu(section, heading);
    });

    this.container.appendChild(section);
  }

  createHeadingSubmenu(parent, heading) {
    const headingGroup = document.createElement('div');
    headingGroup.className = 'layout-heading-group';

    // Bouton pour déplier/replier
    const button = document.createElement('button');
    button.className = 'layout-heading-toggle';
    button.innerHTML = `<span class="toggle-icon">${this.expandedHeadings[heading] ? '▼' : '▶'}</span> ${heading.toUpperCase()}`;
    button.onclick = () => {
      this.expandedHeadings[heading] = !this.expandedHeadings[heading];
      submenu.style.display = this.expandedHeadings[heading] ? 'block' : 'none';
      button.querySelector('.toggle-icon').textContent = this.expandedHeadings[heading] ? '▼' : '▶';
    };

    headingGroup.appendChild(button);

    // Sous-menu dépliable
    const submenu = document.createElement('div');
    submenu.className = 'layout-heading-submenu';
    submenu.style.display = this.expandedHeadings[heading] ? 'block' : 'none';

    const headingStyles = this.template?.generalStyles?.headings?.[heading] || {};

    // Taille de police
    const fontSizeGroup = this.createField('Taille :', 'number', {
      value: headingStyles.fontSize || (heading === 'h1' ? 24 : heading === 'h2' ? 20 : 18),
      min: 8,
      max: 72,
      onChange: (value) => {
        if (!this.template.generalStyles.headings) {
          this.template.generalStyles.headings = {};
        }
        if (!this.template.generalStyles.headings[heading]) {
          this.template.generalStyles.headings[heading] = {};
        }
        this.template.generalStyles.headings[heading].fontSize = parseInt(value);
        if (this.onTemplateChange) {
          this.onTemplateChange({ generalStyles: this.template.generalStyles });
        }
      }
    });
    submenu.appendChild(fontSizeGroup);

    // Checkbox "Utiliser la font globale"
    const useGlobalFontGroup = document.createElement('div');
    useGlobalFontGroup.className = 'layout-field';
    const useGlobalFontLabel = document.createElement('label');
    useGlobalFontLabel.style.display = 'flex';
    useGlobalFontLabel.style.alignItems = 'center';
    useGlobalFontLabel.style.gap = 'var(--spacing-xs)';
    const useGlobalFontCheckbox = document.createElement('input');
    useGlobalFontCheckbox.type = 'checkbox';
    useGlobalFontCheckbox.checked = headingStyles.useGlobalFont !== false; // true par défaut
    useGlobalFontCheckbox.onchange = () => {
      if (!this.template.generalStyles.headings) {
        this.template.generalStyles.headings = {};
      }
      if (!this.template.generalStyles.headings[heading]) {
        this.template.generalStyles.headings[heading] = {};
      }
      this.template.generalStyles.headings[heading].useGlobalFont = useGlobalFontCheckbox.checked;
      if (this.onTemplateChange) {
        this.onTemplateChange({ generalStyles: this.template.generalStyles });
      }
    };
    useGlobalFontLabel.appendChild(useGlobalFontCheckbox);
    useGlobalFontLabel.appendChild(document.createTextNode(' Utiliser la font globale'));
    useGlobalFontGroup.appendChild(useGlobalFontLabel);
    submenu.appendChild(useGlobalFontGroup);

    // Font
    const fontGroup = this.createField('Font :', 'select', {
      options: [
        'Arial',
        'Times New Roman',
        'Courier New',
        'Verdana',
        'Georgia',
        'Helvetica'
      ],
      value: headingStyles.fontFamily || 'Arial',
      onChange: (value) => {
        if (!this.template.generalStyles.headings) {
          this.template.generalStyles.headings = {};
        }
        if (!this.template.generalStyles.headings[heading]) {
          this.template.generalStyles.headings[heading] = {};
        }
        this.template.generalStyles.headings[heading].fontFamily = value;
        if (this.onTemplateChange) {
          this.onTemplateChange({ generalStyles: this.template.generalStyles });
        }
      }
    });
    submenu.appendChild(fontGroup);
    
    // Initialiser la font à Arial par défaut si elle n'existe pas et que useGlobalFont est false
    if (!headingStyles.fontFamily && headingStyles.useGlobalFont === false) {
      if (!this.template.generalStyles.headings) {
        this.template.generalStyles.headings = {};
      }
      if (!this.template.generalStyles.headings[heading]) {
        this.template.generalStyles.headings[heading] = {};
      }
      this.template.generalStyles.headings[heading].fontFamily = 'Arial';
    }

    // Marge gauche/droite
    const marginRow = document.createElement('div');
    marginRow.className = 'layout-field-group';
    
    const marginLabel = document.createElement('label');
    marginLabel.textContent = 'Marges :';
    marginRow.appendChild(marginLabel);

    const marginInputs = document.createElement('div');
    marginInputs.className = 'layout-inputs-row';

    ['left', 'right'].forEach(side => {
      const fieldGroup = document.createElement('div');
      fieldGroup.className = 'layout-field-inline';

      const label = document.createElement('label');
      label.textContent = side === 'left' ? 'Gauche' : 'Droite';
      label.style.fontSize = '0.9em';
      fieldGroup.appendChild(label);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'layout-input-small';
      input.value = headingStyles.margin?.[side] || '0';
      
      input.onchange = () => {
        if (!this.template.generalStyles.headings) {
          this.template.generalStyles.headings = {};
        }
        if (!this.template.generalStyles.headings[heading]) {
          this.template.generalStyles.headings[heading] = {};
        }
        if (!this.template.generalStyles.headings[heading].margin) {
          this.template.generalStyles.headings[heading].margin = {};
        }
        this.template.generalStyles.headings[heading].margin[side] = input.value;
        if (this.onTemplateChange) {
          this.onTemplateChange({ generalStyles: this.template.generalStyles });
        }
      };

      fieldGroup.appendChild(input);
      marginInputs.appendChild(fieldGroup);
    });

    marginRow.appendChild(marginInputs);
    submenu.appendChild(marginRow);

    // Checkbox "Utiliser les marges globales"
    const useGlobalMarginGroup = document.createElement('div');
    useGlobalMarginGroup.className = 'layout-field';
    const useGlobalMarginLabel = document.createElement('label');
    useGlobalMarginLabel.style.display = 'flex';
    useGlobalMarginLabel.style.alignItems = 'center';
    useGlobalMarginLabel.style.gap = 'var(--spacing-xs)';
    const useGlobalMarginCheckbox = document.createElement('input');
    useGlobalMarginCheckbox.type = 'checkbox';
    useGlobalMarginCheckbox.checked = headingStyles.useGlobalMargin !== false; // true par défaut
    useGlobalMarginCheckbox.onchange = () => {
      if (!this.template.generalStyles.headings) {
        this.template.generalStyles.headings = {};
      }
      if (!this.template.generalStyles.headings[heading]) {
        this.template.generalStyles.headings[heading] = {};
      }
      this.template.generalStyles.headings[heading].useGlobalMargin = useGlobalMarginCheckbox.checked;
      if (this.onTemplateChange) {
        this.onTemplateChange({ generalStyles: this.template.generalStyles });
      }
    };
    useGlobalMarginLabel.appendChild(useGlobalMarginCheckbox);
    useGlobalMarginLabel.appendChild(document.createTextNode(' Utiliser les marges globales'));
    useGlobalMarginGroup.appendChild(useGlobalMarginLabel);
    submenu.appendChild(useGlobalMarginGroup);

    // Padding gauche/droite
    const paddingRow = document.createElement('div');
    paddingRow.className = 'layout-field-group';
    
    const paddingLabel = document.createElement('label');
    paddingLabel.textContent = 'Padding :';
    paddingRow.appendChild(paddingLabel);

    const paddingInputs = document.createElement('div');
    paddingInputs.className = 'layout-inputs-row';

    ['left', 'right'].forEach(side => {
      const fieldGroup = document.createElement('div');
      fieldGroup.className = 'layout-field-inline';

      const label = document.createElement('label');
      label.textContent = side === 'left' ? 'Gauche' : 'Droite';
      label.style.fontSize = '0.9em';
      fieldGroup.appendChild(label);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'layout-input-small';
      input.value = headingStyles.padding?.[side] || '0';
      
      input.onchange = () => {
        if (!this.template.generalStyles.headings) {
          this.template.generalStyles.headings = {};
        }
        if (!this.template.generalStyles.headings[heading]) {
          this.template.generalStyles.headings[heading] = {};
        }
        if (!this.template.generalStyles.headings[heading].padding) {
          this.template.generalStyles.headings[heading].padding = {};
        }
        this.template.generalStyles.headings[heading].padding[side] = input.value;
        if (this.onTemplateChange) {
          this.onTemplateChange({ generalStyles: this.template.generalStyles });
        }
      };

      fieldGroup.appendChild(input);
      paddingInputs.appendChild(fieldGroup);
    });

    paddingRow.appendChild(paddingInputs);
    submenu.appendChild(paddingRow);

    // Checkbox "Utiliser la couleur globale"
    const useGlobalColorGroup = document.createElement('div');
    useGlobalColorGroup.className = 'layout-field';
    const useGlobalColorLabel = document.createElement('label');
    useGlobalColorLabel.style.display = 'flex';
    useGlobalColorLabel.style.alignItems = 'center';
    useGlobalColorLabel.style.gap = 'var(--spacing-xs)';
    const useGlobalColorCheckbox = document.createElement('input');
    useGlobalColorCheckbox.type = 'checkbox';
    useGlobalColorCheckbox.checked = headingStyles.useGlobalColor !== false; // true par défaut
    useGlobalColorCheckbox.onchange = () => {
      if (!this.template.generalStyles.headings) {
        this.template.generalStyles.headings = {};
      }
      if (!this.template.generalStyles.headings[heading]) {
        this.template.generalStyles.headings[heading] = {};
      }
      this.template.generalStyles.headings[heading].useGlobalColor = useGlobalColorCheckbox.checked;
      if (this.onTemplateChange) {
        this.onTemplateChange({ generalStyles: this.template.generalStyles });
      }
    };
    useGlobalColorLabel.appendChild(useGlobalColorCheckbox);
    useGlobalColorLabel.appendChild(document.createTextNode(' Utiliser la couleur globale'));
    useGlobalColorGroup.appendChild(useGlobalColorLabel);
    submenu.appendChild(useGlobalColorGroup);

    // Couleur
    const colorGroup = this.createField('Couleur :', 'color', {
      value: headingStyles.color || '#000000',
      onChange: (value) => {
        if (!this.template.generalStyles.headings) {
          this.template.generalStyles.headings = {};
        }
        if (!this.template.generalStyles.headings[heading]) {
          this.template.generalStyles.headings[heading] = {};
        }
        this.template.generalStyles.headings[heading].color = value;
        if (this.onTemplateChange) {
          this.onTemplateChange({ generalStyles: this.template.generalStyles });
        }
      }
    });
    submenu.appendChild(colorGroup);
    
    // Initialiser la couleur à noir par défaut si elle n'existe pas et que useGlobalColor est false
    if (!headingStyles.color && headingStyles.useGlobalColor === false) {
      if (!this.template.generalStyles.headings) {
        this.template.generalStyles.headings = {};
      }
      if (!this.template.generalStyles.headings[heading]) {
        this.template.generalStyles.headings[heading] = {};
      }
      this.template.generalStyles.headings[heading].color = '#000000';
    }

    headingGroup.appendChild(submenu);
    parent.appendChild(headingGroup);
  }

  createField(labelText, type, options = {}) {
    const group = document.createElement('div');
    group.className = 'layout-field';

    const label = document.createElement('label');
    label.textContent = labelText;
    group.appendChild(label);

    let input;
    
    if (type === 'select') {
      input = document.createElement('select');
      input.className = 'layout-select';
      options.options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (opt === options.value) {
          option.selected = true;
        }
        input.appendChild(option);
      });
    } else if (type === 'number') {
      input = document.createElement('input');
      input.type = 'number';
      input.className = 'layout-input';
      input.min = options.min || 0;
      input.max = options.max || 100;
      input.value = options.value || 0;
    } else if (type === 'color') {
      input = document.createElement('input');
      input.type = 'color';
      input.className = 'layout-input-color';
      input.value = options.value || '#000000';
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'layout-input';
      input.value = options.value || '';
    }

    input.onchange = () => {
      if (options.onChange) {
        options.onChange(input.value);
      }
    };

    group.appendChild(input);
    return group;
  }
}

