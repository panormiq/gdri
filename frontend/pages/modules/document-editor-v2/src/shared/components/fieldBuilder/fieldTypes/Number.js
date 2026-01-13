// src/modules/editor/collection/FieldTypes/Nombre.js
export default class Nombre {
  constructor({ field, value, onChange }) {
    this.field = field;
    this.value = value ?? 0; // valeur par défaut 0 si undefined
    this.onChange = onChange;
  }

  render(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field-number';

    const label = document.createElement('label');
    label.textContent = this.field.label;
    wrapper.appendChild(label);

    const input = document.createElement('input');
    input.type = 'number';
    input.value = this.value;
    
    // Si validation max/min définie dans le field
    if (this.field.validation) {
      if (this.field.validation.min?.value != null) input.min = this.field.validation.min.value;
      if (this.field.validation.max?.value != null) input.max = this.field.validation.max.value;
      if (this.field.validation.step?.value != null) input.step = this.field.validation.step.value;
    }

    input.oninput = e => {
      const val = e.target.value;
      this.value = val !== '' ? Number(val) : null; // transforme en number
      this.onChange && this.onChange(this.value);
    };

    wrapper.appendChild(input);
    container.appendChild(wrapper);
  }
}
