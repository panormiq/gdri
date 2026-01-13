// src/modules/editor/shared/fields/Field.js

function generateId() {
  return 'f_' + Math.random().toString(36).substr(2, 9);
}

export default class Field {
  constructor(data = {}, index = null) {
    /* =========================
       IDENTITÉ & POSITION
    ========================= */
    this.id = data.id || generateId();

    this.position =
      data.position !== undefined && data.position !== null
        ? data.position
        : index !== null
        ? index
        : 0;

    /* =========================
       CORE FIELDS (provenant du backend)
       label, name, placeholder, required, indexed
    ========================= */
    const defaultCoreFields = {
      label: { defaultValue: `Champ ${this.position + 1}` },
      name: { defaultValue: '' },
      placeholder: { defaultValue: '' },
      required: { defaultValue: false },
      indexed: { defaultValue: false }
    };

    // Fusion coreFields backend + defaults
    this.coreFields = { ...defaultCoreFields, ...(data.coreFields || {}) };

    // Initialisation des valeurs réelles
    this.core = {};
    Object.entries(this.coreFields).forEach(([key, def]) => {
      this.core[key] =
        data.core?.[key] ??
        def.defaultValue ??
        null;
    });

    /* =========================
       TYPE & BASE TYPE
    ========================= */
    this.type = data.typeRef || data.type || null;
    this.baseType = data.baseType || null;

    /* =========================
       DEFAULT VALUE & VALIDATION
    ========================= */
    this.defaultValue = data.defaultValue ?? null;
    this.validation = data.validation
      ? structuredClone(data.validation)
      : {};

    /* =========================
       OPTIONS (enum, relation…)
    ========================= */
    this.options = data.options || [];

    /* =========================
       USER VALUE
    ========================= */
    this.value = data.value ?? this.defaultValue;

    this.error = null;
  }

  /* =========================
     VALIDATION
  ========================= */
  validate(allowedTypes = []) {
    this.error = null;

    // Champ requis
    if (
      this.core.required &&
      (this.value === null || this.value === undefined || this.value === '')
    ) {
      this.error = 'Ce champ est requis';
      return false;
    }

    // Relation valide
    if (this.type === 'Relation' && this.validation.relatedType) {
      if (!allowedTypes.includes(this.validation.relatedType)) {
        this.error = `Type "${this.validation.relatedType}" introuvable`;
        return false;
      }
    }

    return true;
  }

  /* =========================
     SERIALISATION POUR BACKEND
  ========================= */
  toJSON() {
  return {
    id: this.id,
    key: this.id, // compatibilité backend
    position: this.position,
    typeRef: this.type,
    baseType: this.baseType,
    // 🔹 Déplier coreFields pour le back
    ...this.core,
    defaultValue: this.defaultValue,
    validationOverrides: this.validation,
    options: this.options
  };
}
}

