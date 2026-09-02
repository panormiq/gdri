/**
 * Contrat commun : un champ de collection.
 * Utilisé par les connecteurs (réglages + payload) et les flux agent.
 * Fichier : backend/core/collection-contract/collectionFields.js
 */

const CATALOG = [
  { id: 'text', label: 'Texte' },
  { id: 'textarea', label: 'Zone de texte' },
  { id: 'number', label: 'Nombre' },
  { id: 'boolean', label: 'Oui / Non' },
  { id: 'date', label: 'Date' },
  { id: 'datetime', label: 'Date & heure' },
  { id: 'url', label: 'Lien' },
  { id: 'image', label: 'Image' },
  { id: 'file', label: 'Fichier' },
  { id: 'color', label: 'Couleur' },
  { id: 'enum', label: 'Liste de choix' },
  { id: 'array', label: 'Liste (tags)' },
  { id: 'connection', label: 'Connexion' },
  { id: 'secret', label: 'Secret' }
];

const TYPE_ALIASES = {
  string: 'text',
  texte: 'text',
  Texte: 'text',
  TextArea: 'textarea',
  textarea: 'textarea',
  Lien: 'url',
  lien: 'url',
  uri: 'url',
  currency: 'number',
  nombre: 'number',
  Number: 'number',
  integer: 'number',
  html: 'textarea',
  bool: 'boolean',
  Boolean: 'boolean',
  fichier: 'file',
  Fichier: 'file',
  Image: 'image',
  couleur: 'color',
  Couleur: 'color',
  Date: 'date',
  DateTime: 'datetime',
  'date-time': 'datetime',
  Enum: 'enum',
  select: 'enum',
  Connection: 'connection',
  connector: 'connection',
  connectorRef: 'connection',
  Secret: 'secret',
  password: 'secret',
  tags: 'array',
  object: 'textarea'
};

function catalog() {
  return CATALOG.slice();
}

function normalizeType(raw, extra = {}) {
  const t = String(raw || 'text');
  if (TYPE_ALIASES[t]) return TYPE_ALIASES[t];
  const lower = t.toLowerCase();
  if (TYPE_ALIASES[lower]) return TYPE_ALIASES[lower];
  if (Array.isArray(extra.enum) && extra.enum.length && lower === 'string') return 'enum';
  if (extra.format === 'uri' || extra.format === 'url') return 'url';
  if (extra.format === 'secret' || extra.format === 'password') return 'secret';
  if (extra.format === 'textarea') return 'textarea';
  if (CATALOG.some((item) => item.id === lower)) return lower;
  return 'text';
}

function asEnumList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

function normalizeField(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const key = String(raw.key || raw.name || raw.id || '').trim();
  if (!key) return null;

  const enumValues = asEnumList(
    raw.enum || raw.allowedValues
      || (raw.validation && raw.validation.allowedValues)
      || (raw.validationOverrides && raw.validationOverrides.allowedValues)
  );
  const type = normalizeType(raw.typeRef || raw.uiType || raw.type, {
    enum: enumValues,
    format: raw.format
  });

  const field = {
    key,
    label: String(raw.label || raw.title || key),
    type,
    required: raw.required === true,
    description: String(raw.description || raw.hint || ''),
    placeholder: String(raw.placeholder || ''),
    default: raw.default !== undefined ? raw.default : (raw.defaultValue !== undefined ? raw.defaultValue : undefined),
    multiple: raw.multiple === true || (type === 'enum' && raw.type === 'array'),
    secret: type === 'secret' || raw.secret === true || raw.format === 'secret'
  };

  if (enumValues.length) field.enum = enumValues;
  if (raw.enumLabels && typeof raw.enumLabels === 'object') field.enumLabels = raw.enumLabels;
  if (raw.min != null || raw.minimum != null) field.min = Number(raw.min != null ? raw.min : raw.minimum);
  if (raw.max != null || raw.maximum != null) field.max = Number(raw.max != null ? raw.max : raw.maximum);
  if (raw.step != null) field.step = Number(raw.step);
  if (raw.unit) field.unit = String(raw.unit);
  if (raw.example !== undefined) field.example = raw.example;
  if (raw.connectionSource) field.connectionSource = String(raw.connectionSource);
  if (raw.connectorId) field.connectorId = String(raw.connectorId);
  if (type === 'connection' && !field.connectionSource) {
    field.connectionSource = field.connectorId ? 'connector-instance' : 'mail-account';
  }
  if (raw.graph != null) field.graph = raw.graph;
  return field;
}

function normalizeFields(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeField).filter(Boolean);
}

function fieldsFromJsonSchema(schema) {
  const props = schema && schema.properties && typeof schema.properties === 'object'
    ? schema.properties
    : {};
  const required = new Set(Array.isArray(schema && schema.required) ? schema.required : []);
  const out = [];
  Object.keys(props).forEach((key) => {
    const spec = props[key] || {};
    if (spec.type === 'object') return;
    const itemEnum = spec.items && Array.isArray(spec.items.enum) ? spec.items.enum : null;
    const field = normalizeField({
      key,
      title: spec.title,
      label: spec.title || key,
      type: spec.type,
      format: spec.format,
      description: spec.description,
      default: spec.default,
      enum: spec.enum || itemEnum,
      enumLabels: spec.enumLabels,
      minimum: spec.minimum,
      maximum: spec.maximum,
      required: required.has(key),
      multiple: spec.type === 'array'
    });
    if (field) out.push(field);
  });
  return out;
}

function jsonSchemaFromFields(fields) {
  const properties = {};
  const required = [];
  normalizeFields(fields).forEach((field) => {
    const prop = {
      title: field.label,
      description: field.description || undefined
    };
    if (field.type === 'number') {
      prop.type = 'number';
      if (field.min != null) prop.minimum = field.min;
      if (field.max != null) prop.maximum = field.max;
    } else if (field.type === 'boolean') {
      prop.type = 'boolean';
    } else if (field.type === 'enum' && field.multiple) {
      prop.type = 'array';
      prop.items = { type: 'string', enum: field.enum || [] };
    } else if (field.type === 'array') {
      prop.type = 'array';
      prop.items = { type: 'string' };
    } else if (field.type === 'enum') {
      prop.type = 'string';
      prop.enum = field.enum || [];
    } else {
      prop.type = 'string';
      if (field.type === 'url') prop.format = 'uri';
      if (field.type === 'secret') prop.format = 'secret';
      if (field.type === 'textarea') prop.format = 'textarea';
    }
    if (field.default !== undefined) prop.default = field.default;
    if (field.enumLabels) prop.enumLabels = field.enumLabels;
    properties[field.key] = prop;
    if (field.required) required.push(field.key);
  });
  return {
    type: 'object',
    properties,
    required
  };
}

function defaultsFromFields(fields) {
  const settings = {};
  normalizeFields(fields).forEach((field) => {
    if (field.default !== undefined) settings[field.key] = field.default;
  });
  return settings;
}

function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string' && !value.trim()) return true;
  if (Array.isArray(value) && !value.length) return true;
  return false;
}

function parseValue(field, raw) {
  const type = field && field.type;
  if (type === 'number') {
    if (raw === '' || raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (type === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    if (raw === 'true' || raw === true) return true;
    if (raw === 'false' || raw === false) return false;
    return null;
  }
  if ((type === 'enum' && field.multiple) || type === 'array') {
    if (Array.isArray(raw)) return raw.map((v) => String(v));
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v));
      } catch (_) { /* comma list */ }
      return raw.split(',').map((v) => v.trim()).filter(Boolean);
    }
    return [];
  }
  if (raw == null) return '';
  return String(raw);
}

function validateValues(fields, values) {
  const errors = [];
  const data = values && typeof values === 'object' ? values : {};
  normalizeFields(fields).forEach((field) => {
    const value = data[field.key];
    if (field.required && isEmpty(value)) {
      errors.push(`Le champ « ${field.label} » est obligatoire`);
      return;
    }
    if (isEmpty(value)) return;
    if (field.type === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n)) errors.push(`Le champ « ${field.label} » doit être un nombre`);
      else {
        if (field.min != null && n < field.min) errors.push(`« ${field.label} » doit être ≥ ${field.min}`);
        if (field.max != null && n > field.max) errors.push(`« ${field.label} » doit être ≤ ${field.max}`);
      }
    }
    const allowed = field.enum || [];
    if (allowed.length) {
      const items = field.multiple || field.type === 'array'
        ? (Array.isArray(value) ? value : [value])
        : [value];
      items.forEach((item) => {
        if (!allowed.includes(String(item))) {
          errors.push(`« ${field.label} » : valeur non autorisée (${item})`);
        }
      });
    }
  });
  return { ok: errors.length === 0, errors };
}

module.exports = {
  catalog,
  normalizeType,
  normalizeField,
  normalizeFields,
  fieldsFromJsonSchema,
  jsonSchemaFromFields,
  defaultsFromFields,
  parseValue,
  validateValues
};
