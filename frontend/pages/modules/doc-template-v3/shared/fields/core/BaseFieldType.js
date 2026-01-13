// fields/core/BaseFieldType.js
export default class BaseFieldType {
  getBaseOptionsForm(field) {
    return `
      <div class="form-group">
        <label>
          <input type="checkbox"
                 class="field-required"
                 ${field.required ? 'checked' : ''}>
          Champ requis
        </label>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox"
                 class="field-indexed"
                 ${field.indexed ? 'checked' : ''}>
          Indexer ce champ
        </label>
      </div>
    `;
  }

  hydrateBase(field, container) {
    field.required =
      container.querySelector('.field-required')?.checked || false;

    field.indexed =
      container.querySelector('.field-indexed')?.checked || false;
  }
  
  // Méthodes à surcharger
  getDefaultField() {
    return { options: {}, validation: {} };
  }

  renderOptionsForm(field) {
    return ''; // vide par défaut
  }

  hydrate(field, container) {
    this.hydrateBase(field, container);
  }
}
