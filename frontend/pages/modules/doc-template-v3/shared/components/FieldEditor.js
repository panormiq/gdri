// src/modules/collection-editor/components/FieldEditor.js

import CollectionEditor from './CollectionEditor.js';

class FieldEditor {
  constructor(containerSelector = '#field-form-placeholder') {
    this.container = document.querySelector(containerSelector);
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = '';

    const form = document.createElement('div');
    form.className = 'field-editor-form';

    /* =========================
       KEY
    ========================= */
    const keyInput = document.createElement('input');
    keyInput.placeholder = 'Key (ex: product_name)';
    form.appendChild(keyInput);

    /* =========================
       LABEL
    ========================= */
    const labelInput = document.createElement('input');
    labelInput.placeholder = 'Label (ex: Nom du produit)';
    form.appendChild(labelInput);

    /* =========================
       TYPE SELECT (🔥 ici)
    ========================= */
    const typeSelect = document.createElement('select');

    CollectionEditor.fieldTypes.forEach(type => {
      const opt = document.createElement('option');
      opt.value = type.key;
      opt.textContent = type.label;
      typeSelect.appendChild(opt);
    });

    form.appendChild(typeSelect);

    /* =========================
       REQUIRED
    ========================= */
    const requiredCheckbox = document.createElement('input');
    requiredCheckbox.type = 'checkbox';

    const requiredLabel = document.createElement('label');
    requiredLabel.textContent = 'Champ obligatoire';
    requiredLabel.prepend(requiredCheckbox);

    form.appendChild(requiredLabel);

    /* =========================
       ERROR
    ========================= */
    const errorBox = document.createElement('div');
    errorBox.className = 'field-error';
    form.appendChild(errorBox);

    /* =========================
       SUBMIT
    ========================= */
    const btnAdd = document.createElement('button');
    btnAdd.textContent = 'Ajouter le champ';
    btnAdd.className = 'btn btn-primary';

    btnAdd.addEventListener('click', () => {
      const key = keyInput.value.trim();
      const label = labelInput.value.trim();
      const type = typeSelect.value;

      /* 🔥 VALIDATION UI (ici) */
      if (!key || !label || !type) {
        errorBox.textContent = 'Key, label et type sont obligatoires';
        return;
      }

      if (!CollectionEditor.fieldTypes.some(t => t.key === type)) {
        errorBox.textContent = 'Type de champ invalide';
        return;
      }

      CollectionEditor.addField({
        key,
        label,
        type,
        required: requiredCheckbox.checked
      });

      // Reset form
      keyInput.value = '';
      labelInput.value = '';
      requiredCheckbox.checked = false;
      errorBox.textContent = '';
    });

    form.appendChild(btnAdd);

    this.container.appendChild(form);
  }
}

export default new FieldEditor();
