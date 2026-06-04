/**
 * Persistance des devis configurateur (brouillons sauvegardés).
 * Collection Mongo : ugap_saved_devis (base entreprise).
 */

const crypto = require('crypto');

const COLLECTION = 'ugap_saved_devis';

class UgapSavedDevisService {
  static normalizePayload(raw) {
    const p = raw && typeof raw === 'object' ? raw : {};
    return {
      modelId: p.modelId != null ? String(p.modelId) : null,
      configId: p.configId != null ? String(p.configId) : null,
      selectedOptions: Array.isArray(p.selectedOptions)
        ? p.selectedOptions.map((x) => String(x || '').trim()).filter(Boolean)
        : [],
      fivePercentOptions: Array.isArray(p.fivePercentOptions)
        ? p.fivePercentOptions.map((x) => String(x || '').trim()).filter(Boolean)
        : [],
      fivePercentCustomOptions: Array.isArray(p.fivePercentCustomOptions)
        ? p.fivePercentCustomOptions.filter((x) => x && typeof x === 'object')
        : [],
      use5Percent: !!p.use5Percent,
      devisName: String(p.devisName || '').trim()
    };
  }

  static toClientEntry(doc) {
    if (!doc) return null;
    return {
      id: String(doc.clientId || doc._id?.toString() || '').trim(),
      name: String(doc.name || '').trim(),
      version: Number(doc.version) || 1,
      savedAt: doc.savedAt instanceof Date ? doc.savedAt.toISOString() : String(doc.savedAt || ''),
      payload: this.normalizePayload(doc.payload)
    };
  }

  static async ensureIndexes(db) {
    const col = db.collection(COLLECTION);
    await col.createIndex({ entrepriseId: 1, userId: 1, savedAt: -1 });
    await col.createIndex({ entrepriseId: 1, userId: 1, clientId: 1 }, { unique: true });
    await col.createIndex({ entrepriseId: 1, userId: 1, name: 1, version: -1 });
  }

  static async listVersions(db, entrepriseId, userId) {
    await this.ensureIndexes(db);
    const col = db.collection(COLLECTION);
    const docs = await col
      .find({ entrepriseId: String(entrepriseId), userId: String(userId) })
      .sort({ savedAt: -1 })
      .toArray();
    return docs.map((d) => this.toClientEntry(d)).filter(Boolean);
  }

  static async getByClientId(db, entrepriseId, userId, clientId) {
    const id = String(clientId || '').trim();
    if (!id) return null;
    const col = db.collection(COLLECTION);
    const doc = await col.findOne({
      entrepriseId: String(entrepriseId),
      userId: String(userId),
      clientId: id
    });
    return this.toClientEntry(doc);
  }

  static async createVersion(db, entrepriseId, userId, { name, payload }) {
    await this.ensureIndexes(db);
    const col = db.collection(COLLECTION);
    const finalName = String(name || '').trim() || 'Sans nom';
    const normalizedPayload = this.normalizePayload(payload);
    const sameName = await col
      .find({ entrepriseId: String(entrepriseId), userId: String(userId), name: finalName })
      .sort({ version: -1 })
      .limit(1)
      .toArray();
    const maxVersion = sameName.length ? Number(sameName[0].version) || 0 : 0;
    const nextVersion = maxVersion + 1;
    const now = new Date();
    const clientId = crypto.randomUUID();
    const doc = {
      entrepriseId: String(entrepriseId),
      userId: String(userId),
      clientId,
      name: finalName,
      version: nextVersion,
      savedAt: now,
      updatedAt: now,
      payload: normalizedPayload
    };
    await col.insertOne(doc);
    return this.toClientEntry(doc);
  }

  static async migrateLocalVersions(db, entrepriseId, userId, versions) {
    const list = Array.isArray(versions) ? versions : [];
    if (!list.length) return { imported: 0, skipped: 0 };
    await this.ensureIndexes(db);
    const col = db.collection(COLLECTION);
    let imported = 0;
    let skipped = 0;
    for (const entry of list) {
      const clientId = String(entry?.id || '').trim() || crypto.randomUUID();
      const existing = await col.findOne({
        entrepriseId: String(entrepriseId),
        userId: String(userId),
        clientId
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      const savedAt = entry?.savedAt ? new Date(entry.savedAt) : new Date();
      const doc = {
        entrepriseId: String(entrepriseId),
        userId: String(userId),
        clientId,
        name: String(entry?.name || '').trim() || 'Sans nom',
        version: Number(entry?.version) || 1,
        savedAt: Number.isNaN(savedAt.getTime()) ? new Date() : savedAt,
        updatedAt: new Date(),
        payload: this.normalizePayload(entry?.payload)
      };
      await col.insertOne(doc);
      imported += 1;
    }
    return { imported, skipped };
  }

  static async deleteByClientId(db, entrepriseId, userId, clientId) {
    const id = String(clientId || '').trim();
    if (!id) return false;
    const col = db.collection(COLLECTION);
    const result = await col.deleteOne({
      entrepriseId: String(entrepriseId),
      userId: String(userId),
      clientId: id
    });
    return result.deletedCount > 0;
  }
}

module.exports = UgapSavedDevisService;
