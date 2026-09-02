/**
 * CRUD instances connecteur (config par entité).
 * Fichier : backend/core/connectors/ConnectorInstanceService.js
 */

const { ObjectId } = require('mongodb');
const connectorRegistry = require('./ConnectorRegistry');
const { buildInstancePayload } = require('./instance-defaults');
const { getSettingsFields } = require('./connectorContract');
const { validateValues } = require('../collection-contract/collectionFields');

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

  parseSyntheticId(id) {
    const raw = String(id || '').trim();
    if (raw.startsWith('mail-account:')) {
      return { connectorId: 'mail-in', accountRef: raw.slice('mail-account:'.length) };
    }
    if (raw.startsWith('mail-out-account:')) {
      return { connectorId: 'mail-out', accountRef: raw.slice('mail-out-account:'.length) };
    }
    if (raw.startsWith('fb-page:')) {
      return { connectorId: 'facebook', pageId: raw.slice('fb-page:'.length) };
    }
    return null;
  }

  syntheticInstance(entrepriseId, connectorId, settings = {}) {
    return {
      _id: null,
      entrepriseId: String(entrepriseId || ''),
      connectorId,
      name: settings.accountRef || settings.pageId || connectorId,
      enabled: true,
      settings: { ...(settings && typeof settings === 'object' ? settings : {}) },
      mapping: {},
      credentials: {},
      cursor: null
    };
  }

  /**
   * ObjectId Mongo, ou id synthétique canvas (mail-account:… / fb-page:…).
   */
  async resolve(id, entrepriseId, extras = {}) {
    const raw = String(id || '').trim();
    const hintRef = String(extras.accountRef || '').trim();
    const hintPage = String(extras.pageId || '').trim();
    const hintConnector = String(extras.connectorId || '').trim();
    if (!raw && !hintRef && !hintPage) return null;

    if (raw) {
      const byId = await this.getById(raw, entrepriseId);
      if (byId) return byId;
    }

    const syn = this.parseSyntheticId(raw);
    const accountRef = (syn && syn.accountRef) || hintRef;
    const pageId = (syn && syn.pageId) || hintPage;
    const connectorId = (syn && syn.connectorId) || hintConnector || null;
    const q = { entrepriseId: String(entrepriseId) };
    if (connectorId) q.connectorId = connectorId;

    if (accountRef) {
      const keys = [
        accountRef,
        `mail-in:${accountRef}`,
        `mail-out:${accountRef}`
      ];
      const found = await this.col().findOne({
        ...q,
        $or: [
          { 'settings.accountRef': accountRef },
          { 'settings.mailAccountKey': { $in: keys } }
        ]
      });
      if (found) return serialize(found);
    }
    if (pageId) {
      const found = await this.col().findOne({
        entrepriseId: String(entrepriseId),
        'settings.pageId': pageId
      });
      if (found) return serialize(found);
    }

    if (accountRef && (connectorId === 'mail-in' || connectorId === 'mail-out' || !connectorId)) {
      return this.syntheticInstance(entrepriseId, connectorId || 'mail-in', {
        accountRef,
        mailbox: extras.mailbox || 'INBOX'
      });
    }
    if (pageId) {
      return this.syntheticInstance(entrepriseId, connectorId || 'facebook', {
        pageId,
        pageName: extras.pageName || ''
      });
    }
    return null;
  }

  async create(entrepriseId, payload = {}) {
    const now = new Date();
    const connectorId = String(payload.connectorId || '').trim();
    if (!connectorId) {
      throw new Error('connectorId requis');
    }

    const manifest = connectorRegistry.getManifest(connectorId);
    const merged = buildInstancePayload(manifest, { ...payload, connectorId });
    const settingsCheck = validateValues(getSettingsFields(manifest), merged.settings);
    if (!settingsCheck.ok) {
      throw new Error(settingsCheck.errors[0] || 'Réglages du connecteur invalides');
    }

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
    if (payload.settings != null) {
      const current = await this.getById(id, entrepriseId);
      const manifest = connectorRegistry.getManifest(
        (current && current.connectorId) || payload.connectorId
      );
      const settingsCheck = validateValues(getSettingsFields(manifest), payload.settings);
      if (!settingsCheck.ok) {
        throw new Error(settingsCheck.errors[0] || 'Réglages du connecteur invalides');
      }
      $set.settings = payload.settings;
    }
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
