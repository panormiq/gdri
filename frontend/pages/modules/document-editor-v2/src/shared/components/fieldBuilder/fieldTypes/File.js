// src/modules/editor/collection/FieldTypes/File.js
export default class FileField {
  constructor({ field, value, onChange }) {
    this.field = field;
    this.value = value || null;
    this.onChange = onChange;
  }

  render(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field-file';

    const label = document.createElement('label');
    label.textContent = this.field.label;
    wrapper.appendChild(label);

    const input = document.createElement('input');
    input.type = 'file';

    // Accept (optionnel)
    if (this.field.options?.accept) {
      input.accept = this.field.options.accept;
    }

    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;

      const fileData = {
        file,               // objet File natif
        name: file.name,
        size: file.size,
        type: file.type
      };

      this.value = fileData;
      this.onChange && this.onChange(fileData);
      this.renderPreview(wrapper, fileData);
    };

    wrapper.appendChild(input);

    // Preview si valeur existante
    if (this.value) {
      this.renderPreview(wrapper, this.value);
    }

    container.appendChild(wrapper);
  }

  renderPreview(wrapper, fileData) {
    let preview = wrapper.querySelector('.file-preview');
    if (preview) preview.remove();

    preview = document.createElement('div');
    preview.className = 'file-preview';

    preview.innerHTML = `
      <strong>${fileData.name}</strong><br/>
      ${(fileData.size / 1024).toFixed(1)} KB
    `;

    wrapper.appendChild(preview);
  }
}
