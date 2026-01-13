// src/modules/editor/collection/FieldTypes/date.js
export default class DateField {
  constructor({ field, value, onChange }) {
    this.field = field;

    // Normalisation de la valeur (YYYY-MM-DD)
    this.value = value
      ? this.formatDate(value)
      : field.defaultValue
      ? this.formatDate(field.defaultValue)
      : '';

    this.onChange = onChange;
  }

  formatDate(val) {
    // Accepte Date, timestamp ou string
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }

  render(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field-date';

    const label = document.createElement('label');
    label.textContent = this.field.label;
    wrapper.appendChild(label);

    const input = document.createElement('input');
    input.type = 'date';
    input.value = this.value;

    // Validation optionnelle
    if (this.field.validation) {
      if (this.field.validation.min?.value) {
        input.min = this.formatDate(this.field.validation.min.value);
      }
      if (this.field.validation.max?.value) {
        input.max = this.formatDate(this.field.validation.max.value);
      }
    }

    input.onchange = e => {
      const val = e.target.value || null;
      this.value = val;
      this.onChange && this.onChange(val);
    };

    wrapper.appendChild(input);
    container.appendChild(wrapper);
  }
}
