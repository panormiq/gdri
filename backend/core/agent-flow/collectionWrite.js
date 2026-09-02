/**
 * Sortie → collection V3 (base client). Insert ou upsert par événement.
 * Fichier : backend/core/agent-flow/collectionWrite.js
 */

const { ObjectId } = require('mongodb');
const { resolveSlot, isBlank } = require('./inputMapping');
const { formatScalar } = require('./dataTable');

const META_KEYS = new Set([
  '_id',
  'id',
  'values',
  'createdAt',
  'updatedAt',
  'entrepriseId',
  '__agentFlowId',
  '__agentRunId',
  '__agentSourceRef',
  '__agentNodeId'
]);

async function getEntrepriseDb(entrepriseId) {
  const database = require('../../config/database');
  return database.getEntrepriseDb(entrepriseId);
}

function asObjectId(value) {
  const s = String(value || '').trim();
  if (s && ObjectId.isValid(s) && s.length === 24) return new ObjectId(s);
  return null;
}

async function findCollectionDoc(db, config) {
  const id = String((config && config.collectionId) || '').trim();
  const slug = String((config && config.collectionNamespace) || '').trim();
  if (!id && !slug) return null;
  let col = null;
  const oid = asObjectId(id);
  if (oid) col = await db.collection('collections').findOne({ _id: oid });
  if (!col && slug) {
    col = await db.collection('collections').findOne({ slug })
      || await db.collection('collections').findOne({ name: slug });
  }
  return col;
}

function fieldsFromCollection(col, config) {
  const raw = (col && Array.isArray(col.fields) && col.fields.length)
    ? col.fields
    : (Array.isArray(config && config.modelFields) ? config.modelFields : []);
  return raw.map((f) => ({
    key: String((f && (f.name || f.key)) || '').trim(),
    label: String((f && (f.label || f.name || f.key)) || ''),
    type: String((f && (f.type || f.typeRef || (f.ui && f.ui.uiType) || 'text')) || 'text').toLowerCase(),
    required: !!(f && f.required)
  })).filter((f) => f.key && !META_KEYS.has(f.key));
}

function coerceValue(field, value) {
  if (value === undefined || value === null) return undefined;
  const type = String((field && field.type) || 'text').toLowerCase();
  if (type === 'boolean' || type === 'bool') {
    if (typeof value === 'boolean') return value;
    const s = String(value).trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'oui' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'non' || s === 'no' || s === '') return false;
    return Boolean(value);
  }
  if (type === 'number' || type === 'integer' || type === 'currency') {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }
  if (type === 'file' || type === 'image' || type === 'array' || type === 'json') {
    if (typeof value === 'object') return value;
  }
  if (typeof value === 'object') {
    const formatted = formatScalar(value);
    return formatted === '' ? undefined : formatted;
  }
  const text = formatScalar(value);
  return text === '' ? undefined : text;
}

function valueForField(executor, config, context, field) {
  const resolved = resolveSlot(executor, config, field.key, context);
  if (resolved.mapped && !isBlank(resolved.value)) {
    return coerceValue(field, resolved.value);
  }
  const fromItem = executor.readContextField(context, `item.${field.key}`);
  if (!isBlank(fromItem)) return coerceValue(field, fromItem);
  const direct = executor.readContextField(context, field.key);
  if (!isBlank(direct)) return coerceValue(field, direct);
  if (resolved.mapped) return coerceValue(field, resolved.value);
  return undefined;
}

function sourceRefOf(executor, context) {
  const raw = executor.readContextField(context, 'sourceRef')
    || executor.readContextField(context, 'messageId')
    || (context && context.message && (context.message.sourceRef || context.message.messageId))
    || '';
  return String(raw || '').trim();
}

function runIdOf(context) {
  if (!context) return '';
  if (context.runId) return String(context.runId);
  if (context.run && (context.run._id || context.run.id)) return String(context.run._id || context.run.id);
  return '';
}

async function writeCollectionOutput(executor, flow, config, context) {
  const entrepriseId = flow && flow.entrepriseId;
  if (!entrepriseId) throw new Error('Sortie collection : entreprise manquante');
  const db = await getEntrepriseDb(entrepriseId);
  if (!db) throw new Error('Sortie collection : base client introuvable');

  const col = await findCollectionDoc(db, config || {});
  if (!col) {
    throw new Error('Sortie collection : choisissez une collection existante, ou créez-en une dans l’éditeur.');
  }

  const fields = fieldsFromCollection(col, config);
  if (!fields.length) {
    throw new Error('Collection sans champs. Ouvrez l’éditeur pour définir le schéma, puis réessayez.');
  }

  const now = new Date();
  const colId = String(col._id);
  const dataCol = db.collection(`collection_data_${colId}`);
  const writeMode = String((config && config.writeMode) || 'insert').toLowerCase() === 'upsert'
    ? 'upsert'
    : 'insert';
  const sourceRef = sourceRefOf(executor, context);
  const flowId = String((flow && (flow._id || flow.id)) || '');
  const runId = runIdOf(context);

  const entry = {};
  const missing = [];
  fields.forEach((field) => {
    const value = valueForField(executor, config, context, field);
    if (value === undefined) {
      if (field.required) missing.push(field.label || field.key);
      return;
    }
    entry[field.key] = value;
  });

  entry.__agentFlowId = flowId || null;
  entry.__agentRunId = runId || null;
  entry.__agentSourceRef = sourceRef || null;
  entry.updatedAt = now;

  let elementId = '';
  let written = 'insert';

  if (writeMode === 'upsert' && sourceRef) {
    const existing = await dataCol.findOne({
      __agentSourceRef: sourceRef,
      __agentFlowId: flowId
    });
    if (existing && existing._id) {
      await dataCol.updateOne(
        { _id: existing._id },
        { $set: entry }
      );
      elementId = String(existing._id);
      written = 'update';
    }
  }

  if (!elementId) {
    entry.createdAt = now;
    const inserted = await dataCol.insertOne(entry);
    elementId = String(inserted.insertedId);
    written = 'insert';
  }

  try {
    const oid = asObjectId(colId);
    if (oid) {
      await db.collection('collections').updateOne(
        { _id: oid },
        { $set: { updatedAt: now }, $inc: { dataRevision: 1 } }
      );
    }
  } catch {
    /* la ligne est écrite ; la révision servira au prochain touch */
  }

  return {
    type: 'output-result',
    success: true,
    provider: 'collection',
    collectionId: colId,
    collectionNamespace: String(col.slug || col.name || colId),
    collectionName: String(col.name || col.slug || ''),
    elementId,
    writeMode: written,
    missingRequired: missing,
    fields: Object.keys(entry).filter((k) => !META_KEYS.has(k) && k !== 'createdAt' && k !== 'updatedAt')
  };
}

module.exports = {
  writeCollectionOutput,
  findCollectionDoc,
  fieldsFromCollection
};
