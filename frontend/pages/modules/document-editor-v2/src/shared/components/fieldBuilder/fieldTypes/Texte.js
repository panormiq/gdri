// src/modules/editor/collection/FieldTypes/Texte.js
export default class Texte {
  constructor({ field, value, onChange }) {
    this.field = field;
    this.value = value || '';
    this.onChange = onChange;
  }

  render(container) {
    const label = document.createElement('label');
    label.textContent = this.field.label;
    container.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = this.value;
    input.oninput = e => this.onChange && this.onChange(e.target.value);
    container.appendChild(input);
  }
}
