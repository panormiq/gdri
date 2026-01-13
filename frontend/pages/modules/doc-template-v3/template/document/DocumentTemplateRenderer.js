export default class DocumentTemplateRenderer {
  constructor(template) {
    this.template = template;
  }

  render(container, data = {}) {
    if (!container) throw new Error('container manquant');
    container.innerHTML = '';

    const h1 = document.createElement('h1');
    h1.textContent = this.template.title || 'Document';
    container.appendChild(h1);

    if (Array.isArray(this.template.sections)) {
      this.template.sections.forEach(section => this.renderSection(section, container, data));
    }
  }

  getValueFromData(path, data) {
    if (!path) return ''; // <-- sécurité si path undefined
    return path.split('.').reduce((acc, key) => acc?.[key], data) ?? '';
  }

  renderSection(section, parent, data) {
    const sectionEl = document.createElement('section');

    if (section.title) {
      const h2 = document.createElement('h2');
      h2.textContent = section.title;
      sectionEl.appendChild(h2);
    }

    if (Array.isArray(section.fields)) {
      const ul = document.createElement('ul');
      section.fields.forEach(field => {
        const fieldPath = field.name ?? ''; // <-- sécurité
        const li = document.createElement('li');
        li.textContent = `${field.label ?? '??'}: ${this.getValueFromData(fieldPath, data)}`;
        ul.appendChild(li);
      });
      sectionEl.appendChild(ul);
    }

    if (Array.isArray(section.subSections)) {
      section.subSections.forEach(sub => this.renderSection(sub, sectionEl, data));
    }

    parent.appendChild(sectionEl);
  }
}
