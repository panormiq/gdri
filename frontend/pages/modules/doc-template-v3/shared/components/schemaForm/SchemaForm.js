// Charger le CSS pour SchemaForm
(function loadCSS() {
  if (!document.getElementById('schema-form-styles')) {
    const link = document.createElement('link');
    link.id = 'schema-form-styles';
    link.rel = 'stylesheet';
    const baseUrl = window.BASE_URL || '/';
    link.href = baseUrl + 'pages/modules/doc-template-v3/shared/components/schemaForm/SchemaForm.css';
    document.head.appendChild(link);
  }
})();

export default class SchemaForm {
  constructor({ schema = {}, values = {}, onChange }) {
    this.schema = schema;
    this.values = values;
    this.onChange = onChange;
  }

  render(container) {
    container.innerHTML = '';

    this.root = document.createElement('div');
    this.root.className = 'schema-form';

    Object.entries(this.schema).forEach(([key, config]) => {
      const field = this.renderField(key, config);
      if (field) this.root.appendChild(field);
    });

    container.appendChild(this.root);
  }

  // ===============================
  // RENDER FIELD (CORE)
  // ===============================
  renderField(key, config, parentPath = '') {
    if (!config || typeof config !== 'object') return null;

    const path = parentPath ? `${parentPath}.${key}` : key;

    // ✅ GROUPE (fieldset)
    if (this.isGroup(config)) {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'schema-group';

      const legend = document.createElement('legend');
      legend.textContent = config.label || key;
      fieldset.appendChild(legend);

      Object.entries(config).forEach(([childKey, childConfig]) => {
        if (childKey === 'label') return;

        const child = this.renderField(childKey, childConfig, path);
        if (child) fieldset.appendChild(child);
      });

      return fieldset;
    }

    // ✅ CHAMP SIMPLE
    return this.renderLeafField(key, config, path);
  }

  // ===============================
  // LEAF FIELD
  // ===============================
  renderLeafField(key, config, path) {
    const wrapper = document.createElement('div');
    const input = this.createInput(config, this.getValue(path, config));
    
    // Pour les checkboxes, utiliser une classe spéciale
    if (input.type === 'checkbox') {
      wrapper.className = 'form-field checkbox-field';
    } else {
      wrapper.className = 'form-field';
    }

    const label = document.createElement('label');
    label.textContent = config.label || key;
    if (config.required && input.type !== 'checkbox') {
      label.classList.add('required');
    }
    wrapper.appendChild(label);

    input.oninput = input.onchange = () => {
      const value = this.readInputValue(input, config);
      this.setValue(path, value);
    };

    if (config.required) input.required = true;

    // Pour les checkboxes, mettre l'input avant le label
    if (input.type === 'checkbox') {
      wrapper.insertBefore(input, label);
    } else {
      wrapper.appendChild(input);
    }
    
    return wrapper;
  }

  // ===============================
  // INPUT FACTORY
  // ===============================
  createInput(config, value) {
    const type = config.type || config.fieldType || 'text';
    let input = document.createElement('input');

    switch (type) {
      case 'boolean':
      case 'checkbox':
        input.type = 'checkbox';
        input.checked = Boolean(value);
        break;

      case 'number':
        input.type = 'number';
        input.value = value ?? '';
        break;

      case 'color':
        input.type = 'color';
        input.value = value ?? '#000000';
        break;

      default:
        input.type = 'text';
        input.value = value ?? '';
    }

    return input;
  }

  readInputValue(input, config) {
    const type = config.type || config.fieldType;

    if (type === 'boolean' || type === 'checkbox') {
      return input.checked;
    }

    if (type === 'number') {
      return input.value === '' ? null : Number(input.value);
    }

    return input.value;
  }

  // ===============================
  // VALUES HANDLING
  // ===============================
  getValue(path, config) {
    const existing = path.split('.').reduce((o, k) => o?.[k], this.values);
    if (existing !== undefined) return existing;

    if ('value' in config) return config.value;
    if ('defaultValue' in config) return config.defaultValue;

    return null;
  }

  setValue(path, value) {
    const keys = path.split('.');
    let obj = this.values;

    while (keys.length > 1) {
      const k = keys.shift();
      if (!obj[k] || typeof obj[k] !== 'object') obj[k] = {};
      obj = obj[k];
    }

    obj[keys[0]] = value;

    if (this.onChange) this.onChange(this.values);
  }

  // ===============================
  // TYPE GUARDS
  // ===============================
  isGroup(config) {
    return (
      typeof config === 'object' &&
      !('type' in config) &&
      !('fieldType' in config) &&
      !('value' in config)
    );
  }

  getValues() {
    return this.values;
  }
}
