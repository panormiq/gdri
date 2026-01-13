// src/shared/components/formPage/FormPage.js
import ListPage from '../listPage/ListPage.js';

export default class FormPage {
  constructor({ 
    title = '', 
    coreFields = {}, 
    dynamicFields = [], 
    fieldTypes = {}, 
    onAddDynamicField, 
    onSubmit 
  }) {
    this.title = title;
    this.coreFields = coreFields;
    this.dynamicFields = dynamicFields;
    this.fieldTypes = fieldTypes;
    this.onAddDynamicField = onAddDynamicField;
    this.onSubmit = onSubmit;
  }

  render(container) {
    container.innerHTML = '';

    const h1 = document.createElement('h1');
    h1.textContent = this.title;
    container.appendChild(h1);

    // --- Formulaire principal pour coreFields ---
    const form = document.createElement('form');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '12px';
    container.appendChild(form);

    Object.entries(this.coreFields).forEach(([key, config]) => {
      const wrapper = this.createInputWrapper(key, config);
      form.appendChild(wrapper);
    });

 

    // --- Section ajout champ dynamique ---
    this.renderAddFieldForm(container);

    // --- Liste des champs dynamiques ---
    this.renderDynamicFields(container);
         // Bouton submit
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Valider';
    container.appendChild(submitButton);

    submitButton.onsubmit = (e) => {
      e.preventDefault();
      const coreData = this.getFormData(form);
      if (this.onSubmit) this.onSubmit({ coreData, dynamicFields: this.dynamicFields });
    };
  }

  createInputWrapper(key, config) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '4px';

    const label = document.createElement('label');
    label.textContent = config.label;
    label.htmlFor = key;
    wrapper.appendChild(label);

    let input;
    if (config.type === 'textarea') {
      input = document.createElement('textarea');
    } else if (config.type === 'array') {
      input = document.createElement('input');
      input.placeholder = config.placeholder || '';
    } else {
      input = document.createElement('input');
      input.type = config.type || 'text';
      input.placeholder = config.placeholder || '';
    }

    input.id = key;
    input.required = config.required || false;
    wrapper.appendChild(input);

    return wrapper;
  }

  getFormData(form) {
    const data = {};
    Object.keys(this.coreFields).forEach((key) => {
      const input = form.querySelector(`#${key}`);
      if (this.coreFields[key].type === 'array') {
        data[key] = input.value.split(',').map(v => v.trim()).filter(Boolean);
      } else {
        data[key] = input.value;
      }
    });
    return data;
  }

  // --- Ajouter un champ dynamique ---
  renderAddFieldForm(container) {
    const wrapper = document.createElement('div');
    wrapper.style.marginTop = '24px';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '8px';

    const title = document.createElement('h2');
    title.textContent = 'Ajouter un champ';
    wrapper.appendChild(title);

    // Select type
    const typeSelect = document.createElement('select');
    Object.entries(this.fieldTypes.types).forEach(([key, val]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = val.label;
      typeSelect.appendChild(option);
    });
    wrapper.appendChild(typeSelect);

    // Input label
    const labelInput = document.createElement('input');
    labelInput.placeholder = 'Label du champ';
    wrapper.appendChild(labelInput);

    // Bouton ajouter
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.textContent = 'Ajouter le champ';
    addButton.onclick = () => {
      const field = {
        type: typeSelect.value,
        label: labelInput.value
      };
      this.dynamicFields.push(field);
      if (this.onAddDynamicField) this.onAddDynamicField(field);
      labelInput.value = '';
      this.renderDynamicFields(container);
    };
    wrapper.appendChild(addButton);

    container.appendChild(wrapper);
  
  }

  renderDynamicFields(container) {
    // Supprime l'ancienne liste si elle existe
    const oldList = container.querySelector('#dynamic-fields-list');
    if (oldList) container.removeChild(oldList);

    const listPage = new ListPage({
      title: 'Champs dynamiques',
      items: this.dynamicFields,
      emptyText: 'Aucun champ ajouté',
      mapItemToCard: (field) => ({
        title: field.label,
        subtitle: `Type : ${field.type}`,
        actions: [
          { label: 'Supprimer', onClick: () => this.deleteField(field, container) }
        ]
      })
    });

    const div = document.createElement('div');
    div.id = 'dynamic-fields-list';
    container.appendChild(div);

    listPage.render(div);
  }

  deleteField(field, container) {
    this.dynamicFields = this.dynamicFields.filter(f => f !== field);
    this.renderDynamicFields(container);
  }
}
