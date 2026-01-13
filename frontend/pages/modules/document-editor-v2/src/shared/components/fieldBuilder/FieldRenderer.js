// src/modules/editor/collection/FieldRenderer.js
export default class FieldRenderer {
  constructor({ field, value, onChange }) {
    this.field = field;
    this.value = value;
    this.onChange = onChange;
    this.instance = null;
  }

  async render(container) {
    const uiTypeName = this.field.uiType; // ex: "Texte", "Nombre"
    let FieldClass;

    try {
      // ⚡ Import dynamique en fonction du nom de l'uiType
      
      const module = await import(`./FieldTypes/${uiTypeName}.js`);
      FieldClass = module.default;
    } catch (err) {
      console.warn(`UIType ${uiTypeName} introuvable, fallback vers Texte`, err);
      const fallbackModule = await import(`./FieldTypes/Texte.js`);
      FieldClass = fallbackModule.default;
    }

    // Instanciation
    this.instance = new FieldClass({
      field: this.field,
      value: this.value,
      onChange: this.onChange
    });

    this.instance.render(container);
  }
}
