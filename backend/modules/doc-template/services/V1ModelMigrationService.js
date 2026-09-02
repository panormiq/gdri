/**
 * Copie les modèles V1 (collection globale `models`) vers les collections V3
 * de l'entreprise courante. Idempotent : slug = namespace V1, éléments marqués `_v1VariantId`.
 */
const { ObjectId } = require('mongodb');

const V1_TO_V3_TYPE = {
  text: { type: 'Texte', typeRef: 'string' },
  textarea: { type: 'TextArea', typeRef: 'string' },
  number: { type: 'Number', typeRef: 'number' },
  boolean: { type: 'Boolean', typeRef: 'boolean' },
  date: { type: 'Date', typeRef: 'date' },
  datetime: { type: 'DateTime', typeRef: 'date' },
  url: { type: 'Lien', typeRef: 'string' },
  image: { type: 'Image', typeRef: 'file' },
  file: { type: 'Fichier', typeRef: 'file' },
  color: { type: 'Couleur', typeRef: 'color' },
  enum: { type: 'Enum', typeRef: 'string' },
  array: { type: 'SousCollection', typeRef: 'array' },
  connection: { type: 'Connection', typeRef: 'connection' },
  secret: { type: 'Secret', typeRef: 'secret' }
};

const SKIP_VARIANT_KEYS = {
  id: true,
  _id: true,
  createdAt: true,
  updatedAt: true,
  metadata: true,
  _v1VariantId: true
};

const inflight = new Map();

function toEntrepriseObjectId(entrepriseId) {
  const raw = String(entrepriseId || '').trim();
  if (raw && ObjectId.isValid(raw) && raw.length === 24) {
    return new ObjectId(raw);
  }
  return raw || null;
}

function listV1Models() {
  try {
    const { getModelService } = require('../../agent-documentaire/service-container');
    return getModelService().getAllModels();
  } catch {
    return Promise.resolve([]);
  }
}

function mapV1Field(field, index) {
  const src = field && typeof field === 'object' ? field : {};
  const name = String(src.name || src.key || `field_${index}`).trim() || `field_${index}`;
  const mapped = V1_TO_V3_TYPE[String(src.type || 'text').toLowerCase()] || V1_TO_V3_TYPE.text;
  const validationOverrides = {};
  if (src.unit) validationOverrides.unit = String(src.unit);
  const choices = Array.isArray(src.enum)
    ? src.enum
    : (Array.isArray(src.allowedValues) ? src.allowedValues : []);
  if (choices.length) validationOverrides.allowedValues = choices.map(String);
  if (mapped.type === 'Lien') validationOverrides.pattern = 'url';
  return {
    id: `${name}_${index}`,
    position: index,
    typeRef: mapped.typeRef,
    type: mapped.type,
    label: String(src.label || name),
    name,
    required: !!src.required,
    defaultValue: src.defaultValue == null ? null : src.defaultValue,
    validationOverrides,
    relation: null,
    ui: {}
  };
}

function isMigratedCollection(col, namespace) {
  if (!col) return false;
  const tags = Array.isArray(col.tags) ? col.tags.map((t) => String(t).toLowerCase()) : [];
  if (tags.includes('migrated-v1') || tags.includes(`v1:${String(namespace).toLowerCase()}`)) {
    return true;
  }
  return !!(col.migration && col.migration.source === 'v1');
}

function variantKey(variant, index) {
  if (variant && variant.id != null && String(variant.id).trim()) {
    return String(variant.id);
  }
  return `idx:${index}`;
}

function mapV1Variant(variant, fieldNames, index) {
  const src = variant && typeof variant === 'object' ? variant : {};
  const row = { _v1VariantId: variantKey(src, index) };
  fieldNames.forEach((key) => {
    if (src[key] !== undefined) row[key] = src[key];
  });
  Object.keys(src).forEach((key) => {
    if (!SKIP_VARIANT_KEYS[key] && row[key] === undefined) row[key] = src[key];
  });
  return row;
}

async function syncElements(db, collectionId, v1Model, fieldNames) {
  const dataCol = db.collection(`collection_data_${collectionId}`);
  const variants = Array.isArray(v1Model.variants) ? v1Model.variants : [];
  let inserted = 0;
  for (let i = 0; i < variants.length; i += 1) {
    const row = mapV1Variant(variants[i], fieldNames, i);
    const existing = await dataCol.findOne({ _v1VariantId: row._v1VariantId });
    if (existing) continue;
    const now = new Date();
    await dataCol.insertOne({ ...row, createdAt: now, updatedAt: now });
    inserted += 1;
  }
  return inserted;
}

async function migrateOne(db, entrepriseId, v1Model) {
  const namespace = String(v1Model.namespace || '').trim();
  if (!namespace) return { action: 'skip', reason: 'no-namespace' };

  const collections = db.collection('collections');
  const existing = await collections.findOne({
    $or: [
      { slug: namespace },
      { tags: `v1:${namespace.toLowerCase()}` }
    ]
  });

  const now = new Date();
  const fields = (Array.isArray(v1Model.fields) ? v1Model.fields : []).map(mapV1Field);
  const fieldNames = fields.map((f) => f.name);
  const referenceFields = Array.isArray(v1Model.referenceFields) ? v1Model.referenceFields : [];

  if (existing && !isMigratedCollection(existing, namespace)) {
    return { action: 'skip', reason: 'slug-taken', slug: namespace, collectionId: String(existing._id) };
  }

  let collectionId;
  let action;
  if (existing) {
    collectionId = String(existing._id);
    action = 'sync';
  } else {
    const doc = {
      name: String(v1Model.name || namespace),
      slug: namespace,
      description: 'Importé depuis les modèles documentaires',
      tags: ['migrated-v1', `v1:${namespace.toLowerCase()}`],
      fields,
      referenceFields,
      entrepriseId: toEntrepriseObjectId(entrepriseId),
      migration: {
        source: 'v1',
        v1Namespace: namespace,
        migratedAt: now
      },
      createdAt: now,
      updatedAt: now
    };
    const result = await collections.insertOne(doc);
    collectionId = String(result.insertedId);
    action = 'created';
  }

  const elementsInserted = await syncElements(db, collectionId, v1Model, fieldNames);
  return { action, slug: namespace, collectionId, elementsInserted };
}

async function doMigrate(entrepriseDb, entrepriseId) {
  const models = await listV1Models();
  if (!Array.isArray(models) || !models.length) {
    return { migrated: 0, synced: 0, skipped: 0, results: [] };
  }
  const results = [];
  let migrated = 0;
  let synced = 0;
  let skipped = 0;
  for (const model of models) {
    const result = await migrateOne(entrepriseDb, entrepriseId, model);
    results.push(result);
    if (result.action === 'created') migrated += 1;
    else if (result.action === 'sync') synced += 1;
    else skipped += 1;
  }
  if (migrated || (synced && results.some((r) => r.elementsInserted))) {
    console.log(`📦 Migration V1 → V3: ${migrated} créées, ${synced} synchronisées, ${skipped} ignorées`);
  }
  return { migrated, synced, skipped, results };
}

async function migrateV1ModelsToV3(entrepriseDb, entrepriseId) {
  if (!entrepriseDb) {
    return { migrated: 0, synced: 0, skipped: 0, results: [] };
  }
  const key = String(entrepriseId || 'unknown');
  if (inflight.has(key)) return inflight.get(key);
  const pending = doMigrate(entrepriseDb, entrepriseId).finally(() => inflight.delete(key));
  inflight.set(key, pending);
  return pending;
}

module.exports = {
  migrateV1ModelsToV3,
  mapV1Field
};
