// src/modules/editor/collection/FieldTypes/Color.js
export default class ColorField {
  constructor({ field, value, onChange }) {
    this.field = field;
    this.value =
      value ||
      field.defaultValue ||
      '#000000'; // couleur par défaut
    this.onChange = onChange;
  }

  render(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field-color';

    const label = document.createElement('label');
    label.textContent = this.field.label;
    wrapper.appendChild(label);

    const inputWrapper = document.createElement('div');
    inputWrapper.style.display = 'flex';
    inputWrapper.style.alignItems = 'center';
    inputWrapper.style.gap = '8px';

    const input = document.createElement('input');
    input.type = 'color';
    input.value = this.value;

    const preview = document.createElement('span');
    preview.textContent = this.value;
    preview.style.fontFamily = 'monospace';

    input.oninput = e => {
      this.value = e.target.value;
      preview.textContent = this.value;
      this.onChange && this.onChange(this.value);
    };

    inputWrapper.appendChild(input);
    inputWrapper.appendChild(preview);

    wrapper.appendChild(inputWrapper);
    container.appendChild(wrapper);
  }
}
