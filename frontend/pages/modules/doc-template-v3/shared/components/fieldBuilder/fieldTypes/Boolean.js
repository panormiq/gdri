// src/modules/editor/collection/FieldTypes/boolean.js
export default class BooleanField {
  constructor({ field, value, onChange }) {
    this.field = field;
    this.value = Boolean(value); // force true / false
    this.onChange = onChange;
  }

  render(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field-boolean';

    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '8px';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.value;

    input.onchange = e => {
      this.value = e.target.checked;
      this.onChange && this.onChange(this.value);
    };

    const text = document.createElement('span');
    text.textContent = this.field.label;

    label.appendChild(input);
    label.appendChild(text);
    wrapper.appendChild(label);
    container.appendChild(wrapper);
  }
}
