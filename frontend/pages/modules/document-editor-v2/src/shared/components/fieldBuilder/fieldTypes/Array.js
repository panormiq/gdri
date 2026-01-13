// src/modules/editor/collection/FieldTypes/array.js
export default class ArrayField {
  constructor({ field, value, onChange }) {
    this.field = field;
    this.value = Array.isArray(value)
      ? value
      : Array.isArray(field.defaultValue)
      ? field.defaultValue
      : [];

    this.onChange = onChange;
  }

  render(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field-array';

    const label = document.createElement('label');
    label.textContent = this.field.label;
    wrapper.appendChild(label);

    const list = document.createElement('div');
    list.className = 'array-list';
    wrapper.appendChild(list);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+ Ajouter';
    addBtn.onclick = () => {
      this.value.push('');
      this.update(list);
    };

    wrapper.appendChild(addBtn);
    container.appendChild(wrapper);

    this.update(list);
  }

  update(list) {
    list.innerHTML = '';

    this.value.forEach((val, index) => {
      const row = document.createElement('div');
      row.className = 'array-row';

      const input = document.createElement('input');
      input.type = 'text';
      input.value = val;
      input.oninput = e => {
        this.value[index] = e.target.value;
        this.onChange && this.onChange(this.value);
      };

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '✕';
      removeBtn.onclick = () => {
        this.value.splice(index, 1);
        this.update(list);
      };

      row.appendChild(input);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });

    this.onChange && this.onChange(this.value);
  }
}
