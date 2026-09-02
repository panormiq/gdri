/**
 * Collections de tâche dirigée (Atelier).
 * Première : Design page web — indépendante du type de données du flux hôte.
 */

const { ObjectId } = require('mongodb');
const { normalizeFields } = require('../collection-contract/collectionFields');

const SLUG_PREFIX = 'atelier-';

const PRESETS = {
  'design-page-web': {
    id: 'design-page-web',
    name: 'Design page web',
    description: 'Identité et squelette d’une page (couleurs, logo, zones). Aucun champ métier.',
    tags: ['agent', 'atelier', 'design'],
    fields: [
      { key: 'brand', label: 'Marque / titre', type: 'text', required: true, placeholder: 'Nom affiché dans l’en-tête' },
      { key: 'logoUrl', label: 'Logo (URL)', type: 'url', placeholder: 'https://…' },
      { key: 'primary', label: 'Couleur principale', type: 'color', default: '#1d4ed8' },
      { key: 'background', label: 'Fond', type: 'color', default: '#f1f5f9' },
      { key: 'surface', label: 'Cartes / surfaces', type: 'color', default: '#ffffff' },
      { key: 'text', label: 'Texte', type: 'color', default: '#0f172a' },
      { key: 'muted', label: 'Texte secondaire', type: 'color', default: '#64748b' },
      {
        key: 'zones',
        label: 'Zones',
        type: 'array',
        default: ['header', 'nav', 'main', 'footer'],
        description: 'Trous du squelette, sans lien avec les données métier.'
      },
      { key: 'tone', label: 'Ton / style', type: 'textarea', placeholder: 'Admin SaaS clair, compact…' }
    ]
  },
  hook: {
    id: 'hook',
    name: 'Hook',
    description: 'Où accrocher la page : onglet, modal, app. L’action Accrocher lit ces lignes pour remplir le champ surface.',
    tags: ['agent', 'atelier', 'hook', 'surface'],
    fields: [
      {
        key: 'surface',
        label: 'Surface',
        type: 'text',
        required: true,
        placeholder: 'tab',
        description: 'Identifiant écrit dans le flux (tab, modal, app…).'
      },
      { key: 'label', label: 'Libellé', type: 'text', required: true, placeholder: 'Onglet (éditeur)' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Où la page s’affiche.' }
    ]
  }
};

const HOOK_DEFAULT_ROWS = [
  { surface: 'tab', label: 'Onglet (éditeur)', description: 'Page dans un onglet de l’éditeur agent.' },
  { surface: 'modal', label: 'Modal (run)', description: 'Page dans la fenêtre de run.' },
  { surface: 'app', label: 'App (page user)', description: 'Page dans l’application utilisateur.' }
];

function listAtelierPresets() {
  return Object.values(PRESETS).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    slug: SLUG_PREFIX + p.id,
    fields: normalizeFields(p.fields)
  }));
}

function getAtelierPreset(presetId) {
  const id = String(presetId || '').trim();
  return PRESETS[id] || null;
}

function presetSlug(presetId) {
  return SLUG_PREFIX + String(presetId || '').trim();
}

function collectionFieldsFromPreset(preset) {
  const now = new Date();
  return normalizeFields(preset.fields).map((f, i) => ({
    id: f.key,
    name: f.key,
    label: f.label,
    position: i,
    typeRef: f.type,
    type: f.type,
    required: !!f.required,
    defaultValue: f.default !== undefined ? f.default : null,
    validationOverrides: f.enum ? { allowedValues: f.enum } : {},
    relation: null,
    ui: { uiType: f.type === 'textarea' ? 'TextArea' : f.type === 'color' ? 'Couleur' : 'Texte' },
    description: f.description || '',
    createdAt: now,
    updatedAt: now
  }));
}

async function getEntrepriseDb(entrepriseId) {
  const database = require('../../config/database');
  return database.getEntrepriseDb(entrepriseId);
}

function asObjectId(value) {
  const s = String(value || '').trim();
  if (s && ObjectId.isValid(s) && s.length === 24) return new ObjectId(s);
  return null;
}

async function findAtelierCollection(db, { collectionId, presetId }) {
  const oid = asObjectId(collectionId);
  if (oid) {
    const byId = await db.collection('collections').findOne({ _id: oid });
    if (byId) return byId;
  }
  const preset = getAtelierPreset(presetId);
  if (!preset) return null;
  const slug = presetSlug(preset.id);
  return db.collection('collections').findOne({ slug })
    || db.collection('collections').findOne({ name: preset.name });
}

async function ensureAtelierCollection(entrepriseId, presetId) {
  const preset = getAtelierPreset(presetId || 'design-page-web');
  if (!preset || !entrepriseId) return null;
  const db = await getEntrepriseDb(entrepriseId);
  if (!db) return null;

  const existing = await findAtelierCollection(db, { presetId: preset.id });
  if (existing) {
    const pack = packCollection(existing);
    await seedHookRowsIfNeeded(db, pack.collectionId, preset.id);
    return pack;
  }

  const now = new Date();
  let entrepriseOid = String(entrepriseId);
  if (ObjectId.isValid(entrepriseOid) && entrepriseOid.length === 24) {
    entrepriseOid = new ObjectId(entrepriseOid);
  }
  const doc = {
    name: preset.name,
    slug: presetSlug(preset.id),
    description: preset.description || '',
    fields: collectionFieldsFromPreset(preset),
    tags: preset.tags || ['agent', 'atelier'],
    entrepriseId: entrepriseOid,
    version: '1.0.0',
    dataRevision: 0,
    createdAt: now,
    updatedAt: now
  };
  const inserted = await db.collection('collections').insertOne(doc);
  const pack = packCollection({ _id: inserted.insertedId, ...doc });
  await seedHookRowsIfNeeded(db, pack.collectionId, preset.id);
  return pack;
}

async function seedHookRowsIfNeeded(db, collectionId, presetId) {
  if (String(presetId || '') !== 'hook' || !collectionId) return;
  const dataCol = db.collection(`collection_data_${String(collectionId)}`);
  const n = await dataCol.countDocuments();
  if (n > 0) return;
  const now = new Date();
  await dataCol.insertMany(HOOK_DEFAULT_ROWS.map((row) => ({
    surface: row.surface,
    label: row.label,
    description: row.description,
    createdAt: now,
    updatedAt: now
  })));
}

function flattenAtelierRow(row) {
  if (!row || typeof row !== 'object') return null;
  const src = row.values && typeof row.values === 'object'
    ? { ...row, ...row.values }
    : row;
  const surface = String(src.surface || src.value || src.key || '').trim();
  if (!surface) return null;
  return {
    id: String(row._id || src.id || ''),
    surface,
    label: String(src.label || src.name || surface).trim() || surface,
    description: String(src.description || '').trim()
  };
}

async function listAtelierRows(entrepriseId, collectionId) {
  if (!entrepriseId || !collectionId) return [];
  const db = await getEntrepriseDb(entrepriseId);
  if (!db) return [];
  const oid = asObjectId(collectionId);
  if (!oid) return [];
  const docs = await db.collection(`collection_data_${String(oid)}`)
    .find({})
    .sort({ createdAt: 1 })
    .toArray();
  return docs.map(flattenAtelierRow).filter(Boolean);
}

function packCollection(col) {
  if (!col) return null;
  return {
    collection: col,
    collectionId: String(col._id),
    slug: String(col.slug || ''),
    name: col.name,
    fields: normalizeFields(
      (col.fields || []).map((f) => ({
        key: f.name || f.key,
        label: f.label,
        type: f.type || f.typeRef,
        required: f.required,
        default: f.defaultValue !== undefined ? f.defaultValue : f.default,
        description: f.description,
        enum: f.validationOverrides && f.validationOverrides.allowedValues
      }))
    )
  };
}

async function loadAtelierCollection(entrepriseId, { collectionId, presetId } = {}) {
  if (!entrepriseId) return null;
  const db = await getEntrepriseDb(entrepriseId);
  if (!db) return null;
  let col = await findAtelierCollection(db, { collectionId, presetId });
  if (!col && presetId) {
    return ensureAtelierCollection(entrepriseId, presetId);
  }
  return packCollection(col);
}

function defaultsFromFields(fields) {
  const values = {};
  (fields || []).forEach((f) => {
    if (f && f.key && f.default !== undefined && f.default !== null) {
      values[f.key] = f.default;
    }
  });
  return values;
}

async function writeAtelierRecord(entrepriseId, collectionId, values, meta = {}) {
  const db = await getEntrepriseDb(entrepriseId);
  if (!db) throw new Error('Base client introuvable');
  const oid = asObjectId(collectionId);
  if (!oid) throw new Error('Collection atelier manquante');
  const col = await db.collection('collections').findOne({ _id: oid });
  if (!col) throw new Error('Collection atelier introuvable');
  const now = new Date();
  const dataCol = db.collection(`collection_data_${String(col._id)}`);
  const flowId = String(meta.flowId || '').trim();
  const entry = {
    ...(values && typeof values === 'object' ? values : {}),
    __agentFlowId: flowId || null,
    __agentRunId: meta.runId ? String(meta.runId) : null,
    __agentNodeId: meta.nodeId ? String(meta.nodeId) : null,
    updatedAt: now
  };
  if (flowId) {
    const prev = await dataCol.findOne({ __agentFlowId: flowId });
    if (prev) {
      await dataCol.updateOne({ _id: prev._id }, { $set: entry });
      return { collectionId: String(col._id), elementId: String(prev._id), written: 'update' };
    }
  }
  entry.createdAt = now;
  const inserted = await dataCol.insertOne(entry);
  return { collectionId: String(col._id), elementId: String(inserted.insertedId), written: 'insert' };
}

async function latestAtelierRecord(entrepriseId, collectionId, flowId) {
  const db = await getEntrepriseDb(entrepriseId);
  if (!db) return null;
  const oid = asObjectId(collectionId);
  if (!oid) return null;
  const dataCol = db.collection(`collection_data_${String(oid)}`);
  const fid = String(flowId || '').trim();
  if (fid) {
    const byFlow = await dataCol.findOne({ __agentFlowId: fid }, { sort: { updatedAt: -1 } });
    if (byFlow) return byFlow;
  }
  return dataCol.findOne({}, { sort: { updatedAt: -1 } });
}

module.exports = {
  SLUG_PREFIX,
  PRESETS,
  HOOK_DEFAULT_ROWS,
  listAtelierPresets,
  getAtelierPreset,
  presetSlug,
  ensureAtelierCollection,
  loadAtelierCollection,
  writeAtelierRecord,
  latestAtelierRecord,
  listAtelierRows,
  defaultsFromFields,
  packCollection
};
