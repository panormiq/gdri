// src/modules/editor/collection/FieldRenderer.js
export default class FieldRenderer {
  constructor({ field, value, onChange, collectionId = null }) {
    this.field = field;
    this.value = value;
    this.onChange = onChange;
    this.collectionId = collectionId; // Passer le collectionId pour les images
    this.instance = null;
  }

  async render(container) {
    const uiTypeName = this.field.uiType; // ex: "Texte", "Nombre"
    let FieldClass;

    try {
      // ⚡ Import dynamique en fonction du nom de l'uiType
      
      const module = await import(`./fieldTypes/${uiTypeName}.js`);
      FieldClass = module.default;
    } catch (err) {
      console.warn(`UIType ${uiTypeName} introuvable, fallback vers Texte`, err);
      const fallbackModule = await import(`./fieldTypes/Texte.js`);
      FieldClass = fallbackModule.default;
    }

    // Instanciation
    this.instance = new FieldClass({
      field: this.field,
      value: this.value,
      onChange: this.onChange,
      collectionId: this.collectionId // Passer le collectionId aux champs
    });

    this.instance.render(container);
  }
}
