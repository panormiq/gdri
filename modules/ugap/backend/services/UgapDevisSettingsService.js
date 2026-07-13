/**
 * Paramétrage devis UGAP : options devis + commerciaux.
 * Identité entreprise : source Annuaire (organisation siège / boutique).
 * Collection Mongo : ugap_devis_settings (base entreprise, 1 doc / entrepriseId).
 */

const crypto = require('crypto');
const path = require('path');
const database = require(path.join(__dirname, '../../../../backend/config/database'));
const Entity = require(path.join(__dirname, '../../../../backend/models/Entity'));
const { getCompanyOrganisation } = require(path.join(__dirname, '../../../annuaire/backend/services/organisations/getCompanyOrganisation'));
const organisationToEntrepriseInfo = require(path.join(__dirname, '../../../annuaire/backend/services/organisations/organisationToEntrepriseInfo'));
const { migrateLegacyEntrepriseInfo, hasIdentityData } = require(path.join(__dirname, '../../../annuaire/backend/services/organisations/migrateLegacyEntrepriseInfo'));

const COLLECTION = 'ugap_devis_settings';

const DEVIS_OPTION_FIELDS = [
  'validiteDevisJours',
  'numeroDevisPrefix',
  'conditionsPaiement',
  'delaiLivraison',
  'mentionsLegales'
];

class UgapDevisSettingsService {
  static normalizeDevisOptions(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const validite = Number(s.validiteDevisJours);
    return {
      validiteDevisJours: Number.isFinite(validite) && validite > 0 ? Math.round(validite) : 30,
      numeroDevisPrefix: String(s.numeroDevisPrefix || '').trim(),
      conditionsPaiement: String(s.conditionsPaiement || '').trim(),
      delaiLivraison: String(s.delaiLivraison || '').trim(),
      mentionsLegales: String(s.mentionsLegales || '').trim()
    };
  }

  static normalizeEntrepriseInfo(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const devis = this.normalizeDevisOptions(s);
    return {
      raisonSociale: String(s.raisonSociale || '').trim(),
      formeJuridique: String(s.formeJuridique || '').trim(),
      adresse: String(s.adresse || '').trim(),
      adresseComplement: String(s.adresseComplement || '').trim(),
      codePostal: String(s.codePostal || '').trim(),
      ville: String(s.ville || '').trim(),
      pays: String(s.pays || 'France').trim(),
      siret: String(s.siret || '').trim(),
      tvaIntracommunautaire: String(s.tvaIntracommunautaire || '').trim(),
      rcs: String(s.rcs || '').trim(),
      capitalSocial: String(s.capitalSocial || '').trim(),
      telephone: String(s.telephone || '').trim(),
      email: String(s.email || '').trim(),
      siteWeb: String(s.siteWeb || '').trim(),
      mentionsLegales: devis.mentionsLegales,
      conditionsPaiement: devis.conditionsPaiement,
      validiteDevisJours: devis.validiteDevisJours,
      delaiLivraison: devis.delaiLivraison,
      numeroDevisPrefix: devis.numeroDevisPrefix,
      logoUrl: String(s.logoUrl || s.logo || '').trim()
    };
  }

  static extractDevisOptionsFromLegacy(doc) {
    const d = doc && typeof doc === 'object' ? doc : {};
    if (d.devisOptions && typeof d.devisOptions === 'object') {
      return this.normalizeDevisOptions(d.devisOptions);
    }
    return this.normalizeDevisOptions(d.entrepriseInfo || {});
  }

  static normalizeCommercial(raw) {
    const c = raw && typeof raw === 'object' ? raw : {};
    return {
      id: String(c.id || '').trim() || crypto.randomUUID(),
      userId: String(c.userId || '').trim() || null,
      prenom: String(c.prenom || '').trim(),
      nom: String(c.nom || '').trim(),
      email: String(c.email || '').trim(),
      telephone: String(c.telephone || '').trim(),
      fonction: String(c.fonction || '').trim(),
      actif: c.actif !== false
    };
  }

  static async resolveIdentityFromAnnuaire(db, entrepriseId, doc) {
    const legacyInfo = doc?.entrepriseInfo;
    if (hasIdentityData(legacyInfo)) {
      await migrateLegacyEntrepriseInfo(db, entrepriseId, legacyInfo);
    }

    let entityLogo = '';
    try {
      const entity = await Entity.findById(entrepriseId);
      entityLogo = String(entity?.logo || '').trim();
    } catch (_) {
      entityLogo = '';
    }

    const org = await getCompanyOrganisation(db, entrepriseId);
    const identity = organisationToEntrepriseInfo(org, { entityLogo });
    return {
      identity,
      companyOrganisationId: org?.organisationId || null,
      identityManagedInAnnuaire: true
    };
  }

  static async toClientSettings(db, entrepriseId, doc) {
    const d = doc && typeof doc === 'object' ? doc : {};
    const commerciaux = Array.isArray(d.commerciaux)
      ? d.commerciaux
          .map((c) => this.normalizeCommercial(c))
          .filter((c) => c.id && c.userId)
      : [];
    const devisOptions = this.extractDevisOptionsFromLegacy(d);
    const { identity, companyOrganisationId, identityManagedInAnnuaire } = await this.resolveIdentityFromAnnuaire(
      db,
      entrepriseId,
      d
    );

    return {
      entrepriseInfo: this.normalizeEntrepriseInfo({ ...identity, ...devisOptions }),
      devisOptions,
      commerciaux,
      companyOrganisationId,
      identityManagedInAnnuaire
    };
  }

  static async getDoc(db, entrepriseId) {
    const col = db.collection(COLLECTION);
    return col.findOne({ entrepriseId: String(entrepriseId) });
  }

  static async getSettings(db, entrepriseId) {
    const doc = await this.getDoc(db, entrepriseId);
    return this.toClientSettings(db, entrepriseId, doc);
  }

  static async updateDevisOptions(db, entrepriseId, options) {
    const col = db.collection(COLLECTION);
    const normalized = this.normalizeDevisOptions(options);
    const now = new Date();
    await col.updateOne(
      { entrepriseId: String(entrepriseId) },
      {
        $set: { devisOptions: normalized, updatedAt: now },
        $setOnInsert: { entrepriseId: String(entrepriseId), commerciaux: [], createdAt: now }
      },
      { upsert: true }
    );
    return normalized;
  }

  static async updateEntrepriseInfo(db, entrepriseId, info) {
    const payload = info && typeof info === 'object' ? info : {};
    const devisPatch = {};
    DEVIS_OPTION_FIELDS.forEach((field) => {
      if (payload[field] !== undefined) devisPatch[field] = payload[field];
    });
    const normalized = await this.updateDevisOptions(db, entrepriseId, {
      ...(await this.extractDevisOptionsFromLegacy(await this.getDoc(db, entrepriseId))),
      ...devisPatch
    });
    const settings = await this.getSettings(db, entrepriseId);
    return settings.entrepriseInfo;
  }

  static async upsertCommercial(db, entrepriseId, commercial) {
    const col = db.collection(COLLECTION);
    const normalized = this.normalizeCommercial(commercial);
    const userId = String(normalized.userId || '').trim();
    if (!userId) {
      throw new Error('Sélectionnez un utilisateur lié à l\'entreprise.');
    }
    const entityUser = await this.getEntityUser(entrepriseId, userId);
    if (!entityUser) {
      throw new Error('Cet utilisateur n\'est pas lié à l\'entreprise.');
    }
    normalized.userId = entityUser.userId;
    normalized.prenom = entityUser.firstName || normalized.prenom;
    normalized.nom = entityUser.lastName || normalized.nom;
    normalized.email = entityUser.email || normalized.email;
    normalized.telephone = entityUser.phone || normalized.telephone;

    const doc = await this.getDoc(db, entrepriseId);
    const list = Array.isArray(doc?.commerciaux) ? doc.commerciaux.map((c) => this.normalizeCommercial(c)) : [];
    const duplicate = list.find((c) => c.userId === normalized.userId && c.id !== normalized.id);
    if (duplicate) {
      throw new Error('Cet utilisateur est déjà enregistré comme commercial.');
    }
    const idx = list.findIndex((c) => c.id === normalized.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...normalized, id: list[idx].id };
    } else {
      list.push(normalized);
    }
    const now = new Date();
    await col.updateOne(
      { entrepriseId: String(entrepriseId) },
      {
        $set: { commerciaux: list, updatedAt: now },
        $setOnInsert: { entrepriseId: String(entrepriseId), devisOptions: this.normalizeDevisOptions({}), createdAt: now }
      },
      { upsert: true }
    );
    return normalized;
  }

  static async deleteCommercial(db, entrepriseId, commercialId) {
    const id = String(commercialId || '').trim();
    if (!id) return false;
    const col = db.collection(COLLECTION);
    const doc = await this.getDoc(db, entrepriseId);
    const list = Array.isArray(doc?.commerciaux) ? doc.commerciaux : [];
    const next = list
      .map((c) => this.normalizeCommercial(c))
      .filter((c) => c.id !== id);
    if (next.length === list.length) return false;
    await col.updateOne(
      { entrepriseId: String(entrepriseId) },
      { $set: { commerciaux: next, updatedAt: new Date() } }
    );
    return true;
  }

  static userBelongsToEntity(user, entrepriseId) {
    const wanted = String(entrepriseId || '').trim();
    if (!wanted || !user) return false;
    return (Array.isArray(user.entreprises) ? user.entreprises : []).some((e) => {
      if (!e?.entrepriseId) return false;
      return String(e.entrepriseId) === wanted;
    });
  }

  static mapEntityUser(user) {
    return {
      userId: user._id ? user._id.toString() : '',
      email: String(user.email || '').trim(),
      username: String(user.username || '').trim(),
      firstName: String(user.firstName || user.prenom || '').trim(),
      lastName: String(user.lastName || user.nom || '').trim(),
      phone: String(user.phone || user.telephone || '').trim(),
      status: String(user.status || 'active').trim()
    };
  }

  static async listEntityUsers(entrepriseId) {
    if (!entrepriseId || entrepriseId === 'SYSTEM') return [];
    try {
      const db = await database.connect();
      const usersCollection = db.collection('users');
      const users = await usersCollection.find({}).toArray();
      return users
        .filter((user) => this.userBelongsToEntity(user, entrepriseId))
        .filter((user) => String(user.status || 'active') !== 'inactive')
        .map((user) => this.mapEntityUser(user))
        .filter((u) => u.userId)
        .sort((a, b) => {
          const la = `${a.lastName} ${a.firstName} ${a.email}`.trim().toLowerCase();
          const lb = `${b.lastName} ${b.firstName} ${b.email}`.trim().toLowerCase();
          return la.localeCompare(lb, 'fr');
        });
    } catch (e) {
      console.error('UgapDevisSettingsService.listEntityUsers:', e);
      return [];
    }
  }

  static async getEntityUser(entrepriseId, userId) {
    const uid = String(userId || '').trim();
    if (!uid) return null;
    const users = await this.listEntityUsers(entrepriseId);
    return users.find((u) => u.userId === uid) || null;
  }

  static resolveCommercialForUser(commerciaux, userId) {
    const uid = String(userId || '').trim();
    if (!uid) return null;
    const list = Array.isArray(commerciaux) ? commerciaux : [];
    return list.find((c) => c.actif !== false && String(c.userId || '') === uid) || null;
  }
}

module.exports = UgapDevisSettingsService;
