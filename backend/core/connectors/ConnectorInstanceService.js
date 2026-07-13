/**
 * CRUD instances connecteur (config par entité).
 * Fichier : backend/core/connectors/ConnectorInstanceService.js
 */

const { ObjectId } = require('mongodb');
const connectorRegistry = require('./ConnectorRegistry');
const { buildInstancePayload } = require('./instance-defaults');

const COLLECTION = 'connector_instances';

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  try {
    return new ObjectId(String(id));
  } catch (_) {
    return null;
  }
}

function serialize(doc) {
  if (!doc) return null;
  return {
    ...doc,
    _id: doc._id ? String(doc._id) : null,
    entrepriseId: doc.entrepriseId != null ? String(doc.entrepriseId) : null
  };
}

class ConnectorInstanceService {
  constructor(database) {
    this.database = database;
  }

  col() {
    return this.database.getCollection(COLLECTION);
  }

  async ensureIndexes() {
    const col = this.col();
    await col.createIndex({ entrepriseId: 1, connectorId: 1 });
    await col.createIndex({ enabled: 1 });
  }

  async listByEntreprise(entrepriseId) {
    const docs = await this.col()
      .find({ entrepriseId: String(entrepriseId) })
      .sort({ created_at: -1 })
      .toArray();
    return docs.map(serialize);
  }

  async getById(id, entrepriseId = null) {
    const oid = toObjectId(id);
    if (!oid) return null;
    const query = { _id: oid };
    if (entrepriseId) query.entrepriseId = String(entrepriseId);
    return serialize(await this.col().findOne(query));
  }

  async create(entrepriseId, payload = {}) {
    const now = new Date();
    const connectorId = String(payload.connectorId || '').trim();
    if (!connectorId) {
      throw new Error('connectorId requis');
    }

    const manifest = connectorRegistry.getManifest(connectorId);
    const merged = buildInstancePayload(manifest, { ...payload, connectorId });

    const doc = {
      entrepriseId: String(entrepriseId),
      connectorId,
      name: merged.name,
      enabled: merged.enabled !== false,
      settings: merged.settings && typeof merged.settings === 'object' ? merged.settings : {},
      mapping: merged.mapping && typeof merged.mapping === 'object' ? merged.mapping : {},
      ingestModes: Array.isArray(merged.ingestModes) ? merged.ingestModes : ['push'],
      credentials: merged.credentials && typeof merged.credentials === 'object' ? merged.credentials : {},
      cursor: merged.cursor && typeof merged.cursor === 'object' ? merged.cursor : null,
      presetId: merged.presetId || null,
      created_at: now,
      updated_at: now
    };

    const result = await this.col().insertOne(doc);
    return serialize({ ...doc, _id: result.insertedId });
  }

  async update(id, entrepriseId, payload = {}) {
    const oid = toObjectId(id);
    if (!oid) throw new Error('ID instance invalide');

    const $set = { updated_at: new Date() };
    if (payload.name != null) $set.name = String(payload.name).trim();
    if (payload.enabled != null) $set.enabled = Boolean(payload.enabled);
    if (payload.settings != null) $set.settings = payload.settings;
    if (payload.mapping != null) $set.mapping = payload.mapping;
    if (payload.ingestModes != null) $set.ingestModes = payload.ingestModes;
    if (payload.credentials != null) $set.credentials = payload.credentials;
    if (payload.cursor != null) $set.cursor = payload.cursor;

    await this.col().updateOne(
      { _id: oid, entrepriseId: String(entrepriseId) },
      { $set }
    );

    return this.getById(id, entrepriseId);
  }

  async updateCursor(id, cursor) {
    const oid = toObjectId(id);
    if (!oid) return;
    await this.col().updateOne(
      { _id: oid },
      { $set: { cursor, updated_at: new Date() } }
    );
  }

  async listPollable() {
    const docs = await this.col()
      .find({
        enabled: true,
        ingestModes: { $in: ['poll'] }
      })
      .toArray();
    return docs.map(serialize);
  }

  async delete(id, entrepriseId) {
    const oid = toObjectId(id);
    if (!oid) return false;
    const result = await this.col().deleteOne({
      _id: oid,
      entrepriseId: String(entrepriseId)
    });
    return result.deletedCount > 0;
  }
}

module.exports = { ConnectorInstanceService };
