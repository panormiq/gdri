/**
 * Clients CRM UGAP pour les devis.
 * Collection Mongo : ugap_clients (base entreprise).
 */

const crypto = require('crypto');

const COLLECTION = 'ugap_clients';

class UgapClientsService {
  static normalizeClient(raw) {
    const c = raw && typeof raw === 'object' ? raw : {};
    const type = String(c.type || 'entreprise').trim() === 'particulier' ? 'particulier' : 'entreprise';
    return {
      id: String(c.id || '').trim() || crypto.randomUUID(),
      type,
      raisonSociale: String(c.raisonSociale || '').trim(),
      prenom: String(c.prenom || '').trim(),
      nom: String(c.nom || '').trim(),
      adresse: String(c.adresse || '').trim(),
      adresseComplement: String(c.adresseComplement || '').trim(),
      codePostal: String(c.codePostal || '').trim(),
      ville: String(c.ville || '').trim(),
      pays: String(c.pays || 'France').trim(),
      siret: String(c.siret || '').trim(),
      tvaIntracommunautaire: String(c.tvaIntracommunautaire || '').trim(),
      telephone: String(c.telephone || '').trim(),
      email: String(c.email || '').trim(),
      contactNom: String(c.contactNom || '').trim(),
      contactFonction: String(c.contactFonction || '').trim(),
      notes: String(c.notes || '').trim(),
      createdAt: c.createdAt || null,
      updatedAt: c.updatedAt || null
    };
  }

  static displayName(client) {
    const c = this.normalizeClient(client);
    if (c.type === 'particulier') {
      const full = `${c.prenom} ${c.nom}`.trim();
      return full || c.raisonSociale || 'Client particulier';
    }
    return c.raisonSociale || `${c.prenom} ${c.nom}`.trim() || 'Client entreprise';
  }

  static toClientEntry(doc) {
    if (!doc) return null;
    const normalized = this.normalizeClient(doc);
    return {
      ...normalized,
      displayName: this.displayName(normalized),
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : normalized.createdAt,
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : normalized.updatedAt
    };
  }

  static async ensureIndexes(db) {
    const col = db.collection(COLLECTION);
    await col.createIndex({ entrepriseId: 1, updatedAt: -1 });
    await col.createIndex({ entrepriseId: 1, clientId: 1 }, { unique: true });
  }

  static async list(db, entrepriseId, { search = '' } = {}) {
    await this.ensureIndexes(db);
    const col = db.collection(COLLECTION);
    const query = { entrepriseId: String(entrepriseId) };
    const q = String(search || '').trim().toLowerCase();
    const docs = await col.find(query).sort({ updatedAt: -1 }).toArray();
    let entries = docs.map((d) => this.toClientEntry(d)).filter(Boolean);
    if (q) {
      entries = entries.filter((c) => {
        const hay = [
          c.displayName, c.raisonSociale, c.prenom, c.nom,
          c.email, c.telephone, c.ville, c.siret, c.contactNom
        ].join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    return entries;
  }

  static async getById(db, entrepriseId, clientId) {
    const id = String(clientId || '').trim();
    if (!id) return null;
    const col = db.collection(COLLECTION);
    const doc = await col.findOne({ entrepriseId: String(entrepriseId), clientId: id });
    return this.toClientEntry(doc);
  }

  static async create(db, entrepriseId, data) {
    await this.ensureIndexes(db);
    const col = db.collection(COLLECTION);
    const normalized = this.normalizeClient(data);
    const now = new Date();
    const doc = {
      entrepriseId: String(entrepriseId),
      clientId: normalized.id,
      ...normalized,
      createdAt: now,
      updatedAt: now
    };
    await col.insertOne(doc);
    return this.toClientEntry(doc);
  }

  static async update(db, entrepriseId, clientId, data) {
    const id = String(clientId || '').trim();
    if (!id) throw new Error('Identifiant client requis');
    const col = db.collection(COLLECTION);
    const existing = await col.findOne({ entrepriseId: String(entrepriseId), clientId: id });
    if (!existing) throw new Error('Client introuvable');
    const normalized = this.normalizeClient({ ...existing, ...data, id });
    const now = new Date();
    await col.updateOne(
      { entrepriseId: String(entrepriseId), clientId: id },
      { $set: { ...normalized, updatedAt: now } }
    );
    return this.getById(db, entrepriseId, id);
  }

  static async delete(db, entrepriseId, clientId) {
    const id = String(clientId || '').trim();
    if (!id) return false;
    const col = db.collection(COLLECTION);
    const result = await col.deleteOne({ entrepriseId: String(entrepriseId), clientId: id });
    return result.deletedCount > 0;
  }
}

module.exports = UgapClientsService;
