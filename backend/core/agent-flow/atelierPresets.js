/**
 * Atelier : contrats de champs (catalogue) + valeurs.
 *
 * On ne crée plus une collection vide par type de projet (ex. Design page web)
 * juste pour introspecter son schéma. Les champs nécessaires vivent dans
 * `atelier-schemas` : un élément = un type (ex. « Collection design ») avec
 * un tableau [{ name, type }, …].
 *
 * Les listes métier (Hook : tab / modal / app) restent de vraies collections.
 * Les valeurs de formulaire (design d’un flux) vont dans `atelier-records`,
 * créée seulement au premier enregistrement.
 */

const { ObjectId } = require('mongodb');
const { normalizeFields } = require('../collection-contract/collectionFields');

const SLUG_PREFIX = 'atelier-';
const SCHEMA_CATALOG_SLUG = 'atelier-schemas';
const RECORDS_SLUG = 'atelier-records';

const PRESETS = {
  'design-page-web': {
    id: 'design-page-web',
    schemaSlug: 'design',
    name: 'Collection design',
    description: 'Champs nécessaires pour créer un design (couleurs, logo, zones). Aucun champ métier.',
    tags: ['agent', 'atelier', 'design', 'schema'],
    kind: 'schema',
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
  palette: {
    id: 'palette',
    schemaSlug: 'palette',
    name: 'Palette',
    description: 'Boutons de palette : nom, logo, famille parente, flux d’action. Chacun est une sous-action boîte noire.',
    tags: ['agent', 'atelier', 'palette'],
    kind: 'list',
    fields: [
      { key: 'name', label: 'Nom', type: 'text', required: true, placeholder: 'Hook' },
      { key: 'iconEmoji', label: 'Icône', type: 'text', placeholder: '🪝' },
      { key: 'logoUrl', label: 'Logo (URL)', type: 'url', placeholder: 'https://…' },
      {
        key: 'parentFamily',
        label: 'Famille',
        type: 'text',
        required: true,
        default: 'action',
        placeholder: 'action',
        description: 'Où accrocher le bouton (action, data…).'
      },
      { key: 'flowId', label: 'Flux', type: 'text', placeholder: 'id du flux d’action' },
      { key: 'templateId', label: 'Template', type: 'text', placeholder: 'agent-hook' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Ce que fait cette sous-action.' },
      { key: 'color', label: 'Couleur', type: 'color', default: '#7c3aed' },
      {
        key: 'hookSurface',
        label: 'Hook',
        type: 'text',
        default: 'palette',
        placeholder: 'palette',
        description: 'Surface d’accroche du bloc (palette, tab, modal, app).'
      }
    ]
  },
  hook: {
    id: 'hook',
    schemaSlug: 'hook',
    name: 'Hook',
    description: 'Lignes sélectionnables (surface, libellé, description). Le bloc Visualisation en fait une liste déroulante, sans IA.',
    tags: ['agent', 'atelier', 'hook', 'surface'],
    kind: 'list',
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
  { surface: 'app', label: 'App (page user)', description: 'Page dans l’application utilisateur.' },
  { surface: 'panel', label: 'Panneau droit', description: 'Liste déroulante dans le panneau de config du bloc.' },
  { surface: 'config', label: 'Onglet Configuration', description: 'Liste déroulante dans l’onglet Configuration.' }
];

const SCHEMA_ALIASES = {
  design: 'design-page-web',
  collection_design: 'design-page-web',
  'collection-design': 'design-page-web',
  'design-page-web': 'design-page-web',
  hook: 'hook',
  palette: 'palette'
};

const PALETTE_DEFAULT_ROWS = [
  {
    name: 'Hook',
    iconEmoji: '🪝',
    parentFamily: 'action',
    templateId: 'agent-hook',
    description: 'Sous-action : collection Hook puis ajouter / changer la surface.',
    color: '#7c3aed',
    hookSurface: 'palette'
  }
];

function listAtelierPresets() {
  return Object.values(PRESETS).map((p) => ({
    id: p.id,
    schemaSlug: p.schemaSlug || p.id,
    name: p.name,
    description: p.description,
    kind: p.kind || 'schema',
    slug: p.kind === 'list' ? SLUG_PREFIX + p.id : SCHEMA_CATALOG_SLUG,
    fields: normalizeFields(p.fields)
  }));
}

function getAtelierPreset(presetId) {
  const id = String(presetId || '').trim();
  const mapped = SCHEMA_ALIASES[id] || id;
  return PRESETS[mapped] || null;
}

function schemaSlugFromPreset(presetId) {
  const preset = getAtelierPreset(presetId);
  if (preset && preset.schemaSlug) return preset.schemaSlug;
  const id = String(presetId || '').trim();
  if (id === 'design' || id === 'collection_design' || id === 'collection-design') return 'design';
  return id;
}

function presetSlug(presetId) {
  const preset = getAtelierPreset(presetId);
  if (preset && preset.kind !== 'list') return SCHEMA_CATALOG_SLUG;
  return SLUG_PREFIX + String((preset && preset.id) || presetId || '').trim();
}

function isSchemaOnlyPreset(preset) {
  return !!(preset && preset.kind !== 'list');
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

function catalogCollectionFields() {
  return collectionFieldsFromPreset({
    fields: [
      { key: 'slug', label: 'Identifiant', type: 'text', required: true },
      { key: 'name', label: 'Nom', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      {
        key: 'fields',
        label: 'Champs (nom / type)',
        type: 'textarea',
        description: 'Tableau JSON [{ "name": "brand", "type": "color" }, …]'
      }
    ]
  });
}

function recordsCollectionFields() {
  return collectionFieldsFromPreset({
    fields: [
      { key: 'schemaSlug', label: 'Schéma', type: 'text', required: true },
      { key: 'flowId', label: 'Flux', type: 'text' },
      { key: 'payload', label: 'Valeurs', type: 'textarea' }
    ]
  });
}

function nameTypeFields(fields) {
  return normalizeFields(fields).map((f) => {
    const row = {
      name: f.key,
      type: f.type || 'text'
    };
    if (f.label && f.label !== f.key) row.label = f.label;
    if (f.required) row.required = true;
    if (f.default !== undefined) row.default = f.default;
    if (f.placeholder) row.placeholder = f.placeholder;
    if (f.description) row.description = f.description;
    if (f.enum) row.enum = f.enum;
    return row;
  });
}

function parseFieldList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray(raw.fields)) return raw.fields;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') {
        return Object.keys(parsed).map((name) => ({
          name,
          type: parsed[name]
        }));
      }
    } catch {
      return raw.split(/[\n,;]+/).map((line) => {
        const [name, type] = String(line).split(':').map((s) => s.trim());
        if (!name) return null;
        return { name, type: type || 'text' };
      }).filter(Boolean);
    }
  }
  return [];
}

function fieldsFromNameTypeList(list) {
  return normalizeFields(parseFieldList(list).map((f) => ({
    key: f.name || f.key,
    name: f.name || f.key,
    label: f.label || f.name || f.key,
    type: f.type || f.typeRef || 'text',
    required: f.required,
    default: f.default !== undefined ? f.default : f.defaultValue,
    placeholder: f.placeholder,
    description: f.description,
    enum: f.enum
  })));
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

function entrepriseOid(entrepriseId) {
  let oid = String(entrepriseId);
  if (ObjectId.isValid(oid) && oid.length === 24) return new ObjectId(oid);
  return oid;
}

async function insertCollectionDoc(db, doc) {
  const now = new Date();
  const payload = {
    version: '1.0.0',
    dataRevision: 0,
    createdAt: now,
    updatedAt: now,
    ...doc
  };
  const inserted = await db.collection('collections').insertOne(payload);
  return { _id: inserted.insertedId, ...payload };
}

async function findCollectionBySlug(db, slug, name) {
  if (!slug && !name) return null;
  if (slug) {
    const bySlug = await db.collection('collections').findOne({ slug });
    if (bySlug) return bySlug;
  }
  if (name) return db.collection('collections').findOne({ name });
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
  if (isSchemaOnlyPreset(preset)) {
    return findCollectionBySlug(db, SCHEMA_CATALOG_SLUG, 'Schémas de collections');
  }
  const slug = SLUG_PREFIX + preset.id;
  return findCollectionBySlug(db, slug, preset.name);
}

async function ensureSchemaCatalog(entrepriseId) {
  if (!entrepriseId) return null;
  const db = await getEntrepriseDb(entrepriseId);
  if (!db) return null;
  let col = await findCollectionBySlug(db, SCHEMA_CATALOG_SLUG, 'Schémas de collections');
  if (!col) {
    col = await insertCollectionDoc(db, {
      name: 'Schémas de collections',
      slug: SCHEMA_CATALOG_SLUG,
      description: 'Contrats de champs par type de projet. Un élément = une collection cible + [{ name, type }].',
      fields: catalogCollectionFields(),
      tags: ['agent', 'atelier', 'schema'],
      entrepriseId: entrepriseOid(entrepriseId)
    });
  }
  await seedSchemaElements(db, col);
  return packCollection(col);
}

async function seedSchemaElements(db, catalog) {
  const colId = String(catalog._id);
  const dataCol = db.collection(`collection_data_${colId}`);
  const now = new Date();
  for (const preset of Object.values(PRESETS)) {
    const slug = preset.schemaSlug || preset.id;
    const existing = await dataCol.findOne({ slug });
    if (existing) continue;
    let fields = nameTypeFields(preset.fields);
    if (preset.kind !== 'list') {
      const legacy = await db.collection('collections').findOne({ slug: SLUG_PREFIX + preset.id })
        || await db.collection('collections').findOne({ name: 'Design page web' });
      if (legacy && Array.isArray(legacy.fields) && legacy.fields.length) {
        fields = nameTypeFields(legacy.fields.map((f) => ({
          key: f.name || f.key,
          label: f.label,
          type: f.type || f.typeRef,
          required: f.required,
          default: f.defaultValue !== undefined ? f.defaultValue : f.default,
          description: f.description,
          placeholder: f.placeholder
        })));
      }
    }
    await dataCol.insertOne({
      slug,
      name: preset.name,
      description: preset.description || '',
      fields,
      createdAt: now,
      updatedAt: now
    });
  }
}

async function loadSchemaElement(db, catalogId, schemaSlug) {
  if (!catalogId || !schemaSlug) return null;
  const dataCol = db.collection(`collection_data_${String(catalogId)}`);
  return dataCol.findOne({ slug: String(schemaSlug) });
}

function packSchema(catalog, element, extra = {}) {
  const fields = fieldsFromNameTypeList(element && element.fields);
  return {
    collection: catalog,
    catalogId: String(catalog._id),
    collectionId: extra.recordsCollectionId || '',
    slug: SCHEMA_CATALOG_SLUG,
    schemaSlug: String((element && element.slug) || extra.schemaSlug || 'design'),
    name: (element && element.name) || 'Collection design',
    description: (element && element.description) || '',
    fields,
    fieldContract: nameTypeFields(fields),
    record: extra.record || null,
    rows: extra.rows || []
  };
}

async function findRecordsCollection(db) {
  return findCollectionBySlug(db, RECORDS_SLUG, 'Valeurs atelier');
}

async function ensureRecordsCollection(entrepriseId, db) {
  const conn = db || await getEntrepriseDb(entrepriseId);
  if (!conn) throw new Error('Base client introuvable');
  let col = await findRecordsCollection(conn);
  if (col) return col;
  return insertCollectionDoc(conn, {
    name: 'Valeurs atelier',
    slug: RECORDS_SLUG,
    description: 'Valeurs saisies pour un schéma (design, …), indexées par flux.',
    fields: recordsCollectionFields(),
    tags: ['agent', 'atelier', 'records'],
    entrepriseId: entrepriseOid(entrepriseId)
  });
}

function flattenRecordValues(row) {
  if (!row || typeof row !== 'object') return null;
  const src = row.values && typeof row.values === 'object'
    ? { ...row, ...row.values }
    : { ...row };
  let payload = src.payload;
  if (typeof payload === 'string' && payload.trim()) {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = null;
    }
  }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    Object.keys(payload).forEach((key) => {
      if (src[key] === undefined) src[key] = payload[key];
    });
  }
  return src;
}

async function latestRecordForSchema(db, recordsCol, schemaSlug, flowId) {
  if (!recordsCol || !schemaSlug) return null;
  const dataCol = db.collection(`collection_data_${String(recordsCol._id)}`);
  const fid = String(flowId || '').trim();
  const filter = { schemaSlug: String(schemaSlug) };
  if (fid) {
    const byFlow = await dataCol.findOne(
      { ...filter, $or: [{ __agentFlowId: fid }, { flowId: fid }] },
      { sort: { updatedAt: -1 } }
    );
    if (byFlow) return flattenRecordValues(byFlow);
  }
  const latest = await dataCol.findOne(filter, { sort: { updatedAt: -1 } });
  return flattenRecordValues(latest);
}

async function latestLegacyDesignRecord(db, flowId) {
  const legacy = await db.collection('collections').findOne({ slug: 'atelier-design-page-web' })
    || await db.collection('collections').findOne({ name: 'Design page web' });
  if (!legacy) return null;
  const dataCol = db.collection(`collection_data_${String(legacy._id)}`);
  const fid = String(flowId || '').trim();
  if (fid) {
    const byFlow = await dataCol.findOne({ __agentFlowId: fid }, { sort: { updatedAt: -1 } });
    if (byFlow) return flattenRecordValues(byFlow);
  }
  const n = await dataCol.countDocuments();
  if (!n) return null;
  return flattenRecordValues(await dataCol.findOne({}, { sort: { updatedAt: -1 } }));
}

async function packSchemaPreset(entrepriseId, preset, { flowId } = {}) {
  const catalogPack = await ensureSchemaCatalog(entrepriseId);
  if (!catalogPack) return null;
  const db = await getEntrepriseDb(entrepriseId);
  const schemaSlug = preset.schemaSlug || 'design';
  const element = await loadSchemaElement(db, catalogPack.collectionId, schemaSlug);
  const seededFields = nameTypeFields(preset.fields);
  const elementFields = element ? parseFieldList(element.fields) : [];
  const recordsCol = await findRecordsCollection(db);
  let record = await latestRecordForSchema(db, recordsCol, schemaSlug, flowId);
  if (!record) record = await latestLegacyDesignRecord(db, flowId);
  return packSchema(catalogPack.collection, {
    slug: schemaSlug,
    name: (element && element.name) || preset.name,
    description: (element && element.description) || preset.description,
    fields: elementFields.length ? elementFields : seededFields
  }, {
    schemaSlug,
    recordsCollectionId: recordsCol ? String(recordsCol._id) : '',
    record
  });
}

async function ensureAtelierCollection(entrepriseId, presetId) {
  const preset = getAtelierPreset(presetId || 'design-page-web');
  if (!preset || !entrepriseId) return null;
  if (isSchemaOnlyPreset(preset)) {
    return packSchemaPreset(entrepriseId, preset);
  }

  const db = await getEntrepriseDb(entrepriseId);
  if (!db) return null;

  const existing = await findAtelierCollection(db, { presetId: preset.id });
  if (existing) {
    const pack = packCollection(existing);
    await seedListRowsIfNeeded(db, pack.collectionId, preset.id);
    await ensureSchemaCatalog(entrepriseId);
    return pack;
  }

  const doc = await insertCollectionDoc(db, {
    name: preset.name,
    slug: SLUG_PREFIX + preset.id,
    description: preset.description || '',
    fields: collectionFieldsFromPreset(preset),
    tags: preset.tags || ['agent', 'atelier'],
    entrepriseId: entrepriseOid(entrepriseId)
  });
  const pack = packCollection(doc);
  await seedListRowsIfNeeded(db, pack.collectionId, preset.id);
  await ensureSchemaCatalog(entrepriseId);
  return pack;
}

async function seedListRowsIfNeeded(db, collectionId, presetId) {
  await seedHookRowsIfNeeded(db, collectionId, presetId);
  await seedPaletteRowsIfNeeded(db, collectionId, presetId);
}

async function seedHookRowsIfNeeded(db, collectionId, presetId) {
  if (String(presetId || '') !== 'hook' || !collectionId) return;
  const dataCol = db.collection(`collection_data_${String(collectionId)}`);
  const n = await dataCol.countDocuments();
  const now = new Date();
  if (n === 0) {
    await dataCol.insertMany(HOOK_DEFAULT_ROWS.map((row) => ({
      surface: row.surface,
      label: row.label,
      description: row.description,
      createdAt: now,
      updatedAt: now
    })));
    return;
  }
  for (const row of HOOK_DEFAULT_ROWS) {
    const exists = await dataCol.findOne({
      $or: [{ surface: row.surface }, { 'values.surface': row.surface }]
    });
    if (exists) continue;
    await dataCol.insertOne({
      surface: row.surface,
      label: row.label,
      description: row.description,
      createdAt: now,
      updatedAt: now
    });
  }
}

async function seedPaletteRowsIfNeeded(db, collectionId, presetId) {
  if (String(presetId || '') !== 'palette' || !collectionId) return;
  const dataCol = db.collection(`collection_data_${String(collectionId)}`);
  const n = await dataCol.countDocuments();
  if (n > 0) return;
  const now = new Date();
  await dataCol.insertMany(PALETTE_DEFAULT_ROWS.map((row) => ({
    ...row,
    createdAt: now,
    updatedAt: now
  })));
}

async function writeAtelierListRow(entrepriseId, collectionId, values, meta = {}) {
  if (!entrepriseId || !collectionId) throw new Error('Collection atelier manquante');
  const db = await getEntrepriseDb(entrepriseId);
  if (!db) throw new Error('Base client introuvable');
  const oid = asObjectId(collectionId);
  if (!oid) throw new Error('Collection atelier manquante');
  const dataCol = db.collection(`collection_data_${String(oid)}`);
  const now = new Date();
  const clean = values && typeof values === 'object' ? { ...values } : {};
  delete clean._id;
  delete clean.id;
  const entry = { ...clean, updatedAt: now };
  const rowId = asObjectId(meta.rowId || clean.id);
  if (rowId) {
    const prev = await dataCol.findOne({ _id: rowId });
    if (prev) {
      await dataCol.updateOne({ _id: rowId }, { $set: entry });
      return { collectionId: String(oid), elementId: String(rowId), written: 'update' };
    }
  }
  const flowId = String(meta.flowId || clean.flowId || '').trim();
  if (flowId) {
    const prev = await dataCol.findOne({ flowId });
    if (prev) {
      await dataCol.updateOne({ _id: prev._id }, { $set: entry });
      return { collectionId: String(oid), elementId: String(prev._id), written: 'update' };
    }
  }
  entry.createdAt = now;
  const inserted = await dataCol.insertOne(entry);
  return { collectionId: String(oid), elementId: String(inserted.insertedId), written: 'insert' };
}

function flattenAtelierRow(row) {
  if (!row || typeof row !== 'object') return null;
  const src = row.values && typeof row.values === 'object'
    ? { ...row, ...row.values }
    : { ...row };
  const skip = new Set([
    '_id', 'id', 'values', 'createdAt', 'updatedAt', 'entrepriseId',
    '__agentFlowId', '__agentRunId', '__agentNodeId'
  ]);
  const out = { id: String(row._id || src.id || '') };
  Object.keys(src).forEach((key) => {
    if (skip.has(key) || String(key).indexOf('__') === 0) return;
    out[key] = src[key];
  });
  const surface = String(src.surface || src.value || src.key || '').trim();
  if (surface) out.surface = surface;
  if (src.label != null || src.name != null || surface) {
    out.label = String(src.label || src.name || surface).trim() || surface;
  }
  if (src.description != null) out.description = String(src.description || '').trim();
  if (src.name != null) out.name = String(src.name || '').trim();
  if (!out.surface && !out.name && !out.flowId && !out.templateId) return null;
  return out;
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

async function loadAtelierCollection(entrepriseId, { collectionId, presetId, schemaSlug, flowId } = {}) {
  if (!entrepriseId) return null;
  const slug = schemaSlug || presetId;
  const preset = getAtelierPreset(slug);
  if (preset && isSchemaOnlyPreset(preset)) {
    return packSchemaPreset(entrepriseId, preset, { flowId });
  }
  const db = await getEntrepriseDb(entrepriseId);
  if (!db) return null;
  let col = await findAtelierCollection(db, { collectionId, presetId: slug });
  if (col && String(col.slug || '') === SCHEMA_CATALOG_SLUG) {
    return packSchemaPreset(
      entrepriseId,
      getAtelierPreset(slug || 'design') || PRESETS['design-page-web'],
      { flowId }
    );
  }
  if (!col && slug) {
    return ensureAtelierCollection(entrepriseId, slug);
  }
  return packCollection(col);
}

async function loadSchemaFieldsAsCollection(entrepriseId, schemaSlug) {
  const preset = getAtelierPreset(schemaSlug || 'design');
  if (!preset || !entrepriseId) return null;
  const pack = await packSchemaPreset(entrepriseId, preset);
  if (!pack) return null;
  const rows = (pack.fieldContract || nameTypeFields(pack.fields)).map((row) => ({
    name: row.name,
    type: row.type,
    label: row.label || row.name
  }));
  return {
    modelName: pack.name,
    modelFields: [
      { key: 'name', label: 'Nom', type: 'text', required: true },
      { key: 'type', label: 'Type', type: 'text', required: true },
      { key: 'label', label: 'Libellé', type: 'text' }
    ],
    modelRows: rows,
    collectionId: pack.catalogId,
    collectionNamespace: SCHEMA_CATALOG_SLUG,
    schemaSlug: pack.schemaSlug,
    referenceFields: ['name']
  };
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

function composeTypeFromSchema(type) {
  const t = String(type || 'text').toLowerCase();
  if (t === 'textarea') return 'textarea';
  if (t === 'number') return 'number';
  if (t === 'array' || t === 'file') return t;
  return 'text';
}

function variablesFromFieldContract(rows) {
  return fieldsFromNameTypeList(rows).map((f) => ({
    key: f.key,
    label: f.label || f.key,
    type: composeTypeFromSchema(f.type),
    required: !!f.required,
    description: f.description || '',
    placeholder: f.placeholder || '',
    default: f.default
  })).filter((v) => v.key);
}

function schemaItemsFromContext(context, fieldsFrom) {
  const prev = context && context.previous && typeof context.previous === 'object'
    ? context.previous
    : {};
  const slug = String(fieldsFrom || '').trim();
  const ns = slug && prev.__ns && prev.__ns[slug] ? prev.__ns[slug] : null;
  const bag = ns || prev;
  const items = Array.isArray(bag.items)
    ? bag.items
    : (Array.isArray(bag.modelRows) ? bag.modelRows : []);
  return items.filter((row) => row && (row.name || row.key) && (row.type || row.typeRef || row.label));
}

function mergeComposeFromSchema(config, context) {
  const cfg = config && typeof config === 'object' ? { ...config } : {};
  const fieldsFrom = String(cfg.fieldsFrom || '').trim();
  if (!fieldsFrom) return cfg;
  const schemaVars = variablesFromFieldContract(schemaItemsFromContext(context, fieldsFrom));
  const existing = Array.isArray(cfg.variables) ? cfg.variables : [];
  if (!schemaVars.length) return cfg;
  const byKey = {};
  existing.forEach((v) => {
    if (v && v.key) byKey[v.key] = v;
  });
  const merged = [];
  schemaVars.forEach((v) => {
    const extra = byKey[v.key];
    merged.push(extra ? { ...v, ...extra, key: v.key, type: extra.type || v.type } : v);
    delete byKey[v.key];
  });
  Object.keys(byKey).forEach((k) => merged.push(byKey[k]));
  const values = cfg.values && typeof cfg.values === 'object' ? { ...cfg.values } : {};
  schemaVars.forEach((v) => {
    if (values[v.key] == null && v.default !== undefined && v.default !== null) {
      values[v.key] = Array.isArray(v.default) ? v.default.join(', ') : v.default;
    }
  });
  return { ...cfg, variables: merged, values };
}

const RECORD_META_KEYS = new Set([
  '_id', 'id', 'schemaSlug', 'flowId', 'payload', 'values',
  '__agentFlowId', '__agentRunId', '__agentNodeId',
  'createdAt', 'updatedAt'
]);

async function writeAtelierRecord(entrepriseId, collectionId, values, meta = {}) {
  const db = await getEntrepriseDb(entrepriseId);
  if (!db) throw new Error('Base client introuvable');
  const schemaSlug = schemaSlugFromPreset(meta.schemaSlug || meta.presetId || '');
  const preset = getAtelierPreset(schemaSlug || collectionId);
  const useRecords = isSchemaOnlyPreset(preset) || (!asObjectId(collectionId) && schemaSlug);

  const now = new Date();
  const flowId = String(meta.flowId || '').trim();
  const rawValues = values && typeof values === 'object' ? values : {};
  const cleanValues = {};
  Object.keys(rawValues).forEach((key) => {
    if (!RECORD_META_KEYS.has(key)) cleanValues[key] = rawValues[key];
  });

  if (useRecords) {
    const col = await ensureRecordsCollection(entrepriseId, db);
    const dataCol = db.collection(`collection_data_${String(col._id)}`);
    const slug = schemaSlug || 'design';
    const entry = {
      ...cleanValues,
      schemaSlug: slug,
      flowId: flowId || null,
      payload: JSON.stringify(cleanValues),
      __agentFlowId: flowId || null,
      __agentRunId: meta.runId ? String(meta.runId) : null,
      __agentNodeId: meta.nodeId ? String(meta.nodeId) : null,
      updatedAt: now
    };
    if (flowId) {
      const prev = await dataCol.findOne({
        schemaSlug: slug,
        $or: [{ __agentFlowId: flowId }, { flowId }]
      });
      if (prev) {
        await dataCol.updateOne({ _id: prev._id }, { $set: entry });
        return {
          collectionId: String(col._id),
          elementId: String(prev._id),
          schemaSlug: slug,
          written: 'update'
        };
      }
    }
    entry.createdAt = now;
    const inserted = await dataCol.insertOne(entry);
    return {
      collectionId: String(col._id),
      elementId: String(inserted.insertedId),
      schemaSlug: slug,
      written: 'insert'
    };
  }

  const oid = asObjectId(collectionId);
  if (!oid) throw new Error('Collection atelier manquante');
  const col = await db.collection('collections').findOne({ _id: oid });
  if (!col) throw new Error('Collection atelier introuvable');
  const dataCol = db.collection(`collection_data_${String(col._id)}`);
  const entry = {
    ...cleanValues,
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

async function latestAtelierRecord(entrepriseId, collectionId, flowId, schemaSlug) {
  const db = await getEntrepriseDb(entrepriseId);
  if (!db) return null;
  const slug = schemaSlugFromPreset(schemaSlug || '');
  if (slug && slug !== 'hook') {
    const recordsCol = await findRecordsCollection(db);
    const fromRecords = await latestRecordForSchema(db, recordsCol, slug || 'design', flowId);
    if (fromRecords) return fromRecords;
    const legacy = await latestLegacyDesignRecord(db, flowId);
    if (legacy) return legacy;
  }
  const oid = asObjectId(collectionId);
  if (!oid) return null;
  const dataCol = db.collection(`collection_data_${String(oid)}`);
  const fid = String(flowId || '').trim();
  if (fid) {
    const byFlow = await dataCol.findOne({ __agentFlowId: fid }, { sort: { updatedAt: -1 } });
    if (byFlow) return flattenRecordValues(byFlow);
  }
  return flattenRecordValues(await dataCol.findOne({}, { sort: { updatedAt: -1 } }));
}

module.exports = {
  SLUG_PREFIX,
  SCHEMA_CATALOG_SLUG,
  RECORDS_SLUG,
  PRESETS,
  HOOK_DEFAULT_ROWS,
  PALETTE_DEFAULT_ROWS,
  listAtelierPresets,
  getAtelierPreset,
  schemaSlugFromPreset,
  presetSlug,
  ensureAtelierCollection,
  ensureSchemaCatalog,
  loadAtelierCollection,
  loadSchemaFieldsAsCollection,
  writeAtelierRecord,
  writeAtelierListRow,
  latestAtelierRecord,
  listAtelierRows,
  defaultsFromFields,
  packCollection,
  nameTypeFields,
  fieldsFromNameTypeList,
  variablesFromFieldContract,
  mergeComposeFromSchema
};
