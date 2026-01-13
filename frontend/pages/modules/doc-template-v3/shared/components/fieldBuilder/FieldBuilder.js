import SchemaForm from '../schemaForm/SchemaForm.js';// Charger le CSS pour FieldBuilder
(function loadCSS() {
  if (!document.getElementById('field-builder-styles')) {
    const link = document.createElement('link');
    link.id = 'field-builder-styles';
    link.rel = 'stylesheet';
    const baseUrl = window.BASE_URL || '/';
    link.href = baseUrl + 'pages/modules/doc-template-v3/shared/components/fieldBuilder/FieldBuilder.css';
    document.head.appendChild(link);
  }
})();

export default class FieldBuilder {
  constructor({ fieldCoreSchema, baseTypes, types, fieldData = null, onAdd }) {
    this.fieldCoreSchema = fieldCoreSchema;
    this.baseTypes = baseTypes;
    this.types = types;
    this.onAdd = onAdd;
    this.fieldData = fieldData;

    this.coreData = fieldData || {};
    this.validationData = fieldData?.validation || {};
    this.settingsData = fieldData?.settings || {};

    this.selectedTypeKey = fieldData?.uiType || null;
    this.typeDef = fieldData ? this.types[this.selectedTypeKey] : null;
    this.baseType = this.typeDef ? this.baseTypes[this.typeDef.typeRef] : null;
  }

  render(container) {
    this.container = document.createElement('div');
    this.container.className = 'field-builder';

    // ---- Core field form ----
    const coreTitle = document.createElement('h3');
    coreTitle.textContent = 'Propriétés du champ';
    this.container.appendChild(coreTitle);

    this.coreForm = new SchemaForm({
      schema: this.fieldCoreSchema,
      values: this.coreData,
      onChange: data => (this.coreData = data)
    });
    this.coreForm.render(this.container);

    // ---- Type selector ----
    this.renderTypeSelector();

    // ---- Validation container ----
    this.validationContainer = document.createElement('div');
    this.container.appendChild(this.validationContainer);

    // ---- Options container ----
    this.optionsContainer = document.createElement('div');
    this.container.appendChild(this.optionsContainer);

    // ---- Settings container ----
    this.settingsContainer = document.createElement('div');
    this.settingsContainer.className = 'field-settings';
    this.container.appendChild(this.settingsContainer);

    // ---- Add button ----
    const addBtn = document.createElement('button');
    addBtn.textContent = this.fieldData ? 'Mettre à jour le champ' : 'Ajouter le champ';
    addBtn.onclick = () => this.addField();
    this.container.appendChild(addBtn);

    container.appendChild(this.container);

    // Si on édite un champ existant, préremplir type, options et settings
    if (this.fieldData && this.selectedTypeKey) {
      this.onTypeChange(this.selectedTypeKey);
    }
  }

  renderTypeSelector() {
    const wrapper = document.createElement('div');
    wrapper.className = 'type-selector';

    const label = document.createElement('label');
    label.textContent = 'Type du champ';
    wrapper.appendChild(label);

    const select = document.createElement('select');
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '-- Choisir un type --';
    select.appendChild(empty);

    Object.entries(this.types).forEach(([key, type]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = type.label;
      select.appendChild(opt);
    });

    select.value = this.selectedTypeKey || '';
    select.onchange = () => this.onTypeChange(select.value);
    wrapper.appendChild(select);

    this.container.appendChild(wrapper);
  }

  onTypeChange(typeKey) {
    if (!typeKey) return;

    this.selectedTypeKey = typeKey;
    this.typeDef = this.types[typeKey];
    this.baseType = this.baseTypes[this.typeDef.typeRef];

    // ⚡ uiType du baseType
    this.typeDef.uiType = this.baseType?.uiType || this.typeDef.uiType;

    // ---- Validation ----
    this.validationContainer.innerHTML = '';
    this.validationData = {};
    if (this.baseType?.validation) {
      const title = document.createElement('h4');
      title.textContent = 'Validation';
      this.validationContainer.appendChild(title);

      const baseValidation = this.baseType.validation;
      const typeValidation = this.typeDef.validation || {};
      const schemaValues = {};
      for (const key in baseValidation) {
        schemaValues[key] = typeValidation[key] ?? baseValidation[key].value ?? null;
      }

      this.validationForm = new SchemaForm({
        schema: baseValidation,
        values: schemaValues,
        onChange: data => (this.validationData = data)
      });
      this.validationForm.render(this.validationContainer);
    }

    // ---- Options ----
    this.optionsContainer.innerHTML = '';
    this.createOptionInputs(this.optionsContainer, this.typeDef.options);

    // ---- Settings ----
    this.settingsContainer.innerHTML = '';
    this.renderSettings(this.settingsContainer, this.typeDef.settings);
  }

  createOptionInputs(container, options = {}) {
    Object.entries(options).forEach(([key, optData]) => {
      const group = document.createElement('fieldset');

      // Label et checkbox par défaut
      const legend = document.createElement('legend');
      legend.textContent = optData.label || key;
      group.appendChild(legend);

      const enabledInput = document.createElement('input');
      enabledInput.type = optData.uiType === 'checkbox' || !optData.uiType ? 'checkbox' : optData.uiType;
      enabledInput.checked = optData.enabled ?? false;
      enabledInput.onchange = () => {
        optData.enabled = enabledInput.checked;
      };
      group.appendChild(enabledInput);

      container.appendChild(group);
    });
  }

  renderSettings(container, settings = {}) {
    Object.entries(settings).forEach(([key, sData]) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'setting-field';

      const label = document.createElement('label');
      label.textContent = sData.label;
      wrapper.appendChild(label);

      const input = document.createElement('input');
      input.type = sData.type || 'text';
      input.value = this.settingsData[key] ?? sData.defaultValue ?? '';
      input.oninput = () => {
        this.settingsData[key] = input.value;
      };
      wrapper.appendChild(input);

      container.appendChild(wrapper);
    });
  }

  addField() {
    if (!this.selectedTypeKey || !this.typeDef || !this.baseType) {
      alert('Veuillez choisir un type');
      return;
    }

    const field = {
      ...this.coreData,
      type: this.selectedTypeKey,
      typeRef: this.typeDef.typeRef,
      uiType: this.baseType.uiType,
      validation: this.validationData,
      options: this.typeDef.options || {},
      settings: this.settingsData
    };

    if (this.onAdd) this.onAdd(field);
    this.reset();
  }

  reset() {
    this.container.remove();
  }
}
