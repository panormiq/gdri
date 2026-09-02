/**
 * Listes préconstruites (mail, réseaux sociaux, contact) → collections V3.
 * Fichier : backend/core/agent-flow/presetCollections.js
 */

const { ObjectId } = require('mongodb');
const { getPreset, listPresets } = require('./intentionPresets');

const SLUG_PREFIX = 'preset-intentions-';

function presetCollectionSlug(presetId) {
  return SLUG_PREFIX + String(presetId || '').trim();
}

function isPresetCollectionSlug(slug) {
  return String(slug || '').indexOf(SLUG_PREFIX) === 0;
}

function presetIdFromSlug(slug) {
  const s = String(slug || '').trim();
  if (!isPresetCollectionSlug(s)) return '';
  return s.slice(SLUG_PREFIX.length);
}

function intentionFields() {
  const now = new Date();
  return [
    {
      id: 'name',
      name: 'name',
      label: 'Nom',
      position: 0,
      typeRef: 'string',
      type: 'text',
      required: true,
      defaultValue: null,
      validationOverrides: {},
      relation: null,
      ui: { uiType: 'Texte' },
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'definition',
      name: 'definition',
      label: 'Définition',
      position: 1,
      typeRef: 'string',
      type: 'textarea',
      required: false,
      defaultValue: null,
      validationOverrides: {},
      relation: null,
      ui: { uiType: 'TextArea' },
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'priority',
      name: 'priority',
      label: 'Priorité',
      position: 2,
      typeRef: 'string',
      type: 'text',
      required: false,
      defaultValue: 'medium',
      validationOverrides: { allowedValues: ['low', 'medium', 'urgent'] },
      relation: null,
      ui: { uiType: 'Texte' },
      createdAt: now,
      updatedAt: now
    }
  ];
}

function listPresetCollectionMeta() {
  return listPresets().map((p) => ({
    ...p,
    slug: presetCollectionSlug(p.id),
    collectionKind: 'intentions'
  }));
}

async function getEntrepriseDb(entrepriseId) {
  const database = require('../../config/database');
  return database.getEntrepriseDb(entrepriseId);
}

async function findPresetCollection(db, preset) {
  const slug = presetCollectionSlug(preset.id);
  const bySlug = await db.collection('collections').findOne({ slug });
  if (bySlug) return bySlug;
  return db.collection('collections').findOne({ name: `Intentions — ${preset.label}` });
}

async function loadCollectionBundle(db, col) {
  if (!col) return null;
  const colId = String(col._id);
  const elements = await db.collection(`collection_data_${colId}`).find({}).toArray();
  return { collection: col, elements, collectionId: colId, slug: String(col.slug || '') };
}

/**
 * Crée (ou réutilise) la collection V3 d’un preset. Ne réécrit pas les lignes déjà éditées.
 */
async function ensurePresetCollection(entrepriseId, presetId) {
  const preset = getPreset(presetId);
  if (!preset || !entrepriseId) return null;
  const db = await getEntrepriseDb(entrepriseId);
  if (!db) return null;

  const existing = await findPresetCollection(db, preset);
  if (existing) {
    const bundle = await loadCollectionBundle(db, existing);
    if (bundle && bundle.elements && bundle.elements.length) return bundle;
    await seedPresetElements(db, existing, preset);
    return loadCollectionBundle(db, existing);
  }

  const now = new Date();
  const slug = presetCollectionSlug(preset.id);
  let entrepriseOid = String(entrepriseId);
  try {
    if (ObjectId.isValid(entrepriseOid) && entrepriseOid.length === 24) {
      entrepriseOid = new ObjectId(entrepriseOid);
    }
  } catch {
    /* garder la string */
  }

  const doc = {
    name: `Intentions — ${preset.label}`,
    slug,
    description: preset.description || '',
    fields: intentionFields(),
    tags: ['agent', 'preset', 'intentions', preset.id],
    entrepriseId: entrepriseOid,
    version: '1.0.0',
    dataRevision: 0,
    createdAt: now,
    updatedAt: now
  };
  const inserted = await db.collection('collections').insertOne(doc);
  const col = { _id: inserted.insertedId, ...doc };
  await seedPresetElements(db, col, preset);
  return loadCollectionBundle(db, col);
}

async function seedPresetElements(db, col, preset) {
  const colId = String(col._id);
  const dataCol = db.collection(`collection_data_${colId}`);
  const existing = await dataCol.countDocuments();
  if (existing) return;
  const now = new Date();
  const rows = (preset.intentions || []).map((it) => ({
    name: String(it.name || it.id || ''),
    definition: String(it.definition || ''),
    priority: String(it.priority || 'medium'),
    createdAt: now,
    updatedAt: now
  })).filter((row) => row.name);
  if (rows.length) await dataCol.insertMany(rows);
}

module.exports = {
  SLUG_PREFIX,
  presetCollectionSlug,
  isPresetCollectionSlug,
  presetIdFromSlug,
  listPresetCollectionMeta,
  ensurePresetCollection
};
