/**
 * FICHIER : modules/annuaire/backend/services/organisations/updateOrganisation.js
 */

const getOrganisationById = require('./getOrganisationById');
const toOrganisationEntry = require('./toOrganisationEntry');
const { normalizeRoles } = require('./organisationRoles');
const syncOwnOrganisationToEntity = require('./syncOwnOrganisationToEntity');
const setPrimaryCompanyOrganisation = require('./setPrimaryCompanyOrganisation');

const COLLECTION = 'annuaire_organisations';

const IDENTITY_PATCH_KEYS = new Set([
  'raisonSociale', 'prenom', 'nom', 'siret', 'formeJuridique', 'tvaIntracommunautaire',
  'rcs', 'capitalSocial', 'adresse', 'adresseComplement', 'codePostal', 'ville', 'pays',
  'email', 'telephone', 'siteWeb', 'logo', 'notes'
]);

function applyStringPatch(update, key, value) {
  update[key] = String(value || '').trim();
}

function isGdriMirrorOrg(org, update) {
  if (!org) return false;
  if (org.isOwnEntity) return true;
  if (!org.gderpiBoutiqueId) return false;
  return update.isPrimaryCompany === true || org.isPrimaryCompany === true;
}

async function updateOrganisation(db, entrepriseId, organisationId, patch = {}) {
  const existing = await getOrganisationById(db, entrepriseId, organisationId);
  if (!existing) throw new Error('Organisation introuvable');

  const p = patch && typeof patch === 'object' ? patch : {};
  const syncFromEntity = p._syncFromEntity === true;
  const syncFromGderpi = p._syncFromGderpi === true;
  const update = { updatedAt: new Date() };

  if (p.raisonSociale !== undefined) update.raisonSociale = String(p.raisonSociale || '').trim();
  if (p.prenom !== undefined) update.prenom = String(p.prenom || '').trim();
  if (p.nom !== undefined) update.nom = String(p.nom || '').trim();
  if (p.type !== undefined) update.type = String(p.type || 'entreprise');
  if (p.scope !== undefined) update.scope = String(p.scope || 'externe');
  if (p.roles !== undefined) update.roles = normalizeRoles(p.roles);
  if (p.siret !== undefined) update.siret = String(p.siret || '').trim();
  if (p.formeJuridique !== undefined) applyStringPatch(update, 'formeJuridique', p.formeJuridique);
  if (p.tvaIntracommunautaire !== undefined) applyStringPatch(update, 'tvaIntracommunautaire', p.tvaIntracommunautaire);
  if (p.rcs !== undefined) applyStringPatch(update, 'rcs', p.rcs);
  if (p.capitalSocial !== undefined) applyStringPatch(update, 'capitalSocial', p.capitalSocial);
  if (p.adresse !== undefined) applyStringPatch(update, 'adresse', p.adresse);
  if (p.adresseComplement !== undefined) applyStringPatch(update, 'adresseComplement', p.adresseComplement);
  if (p.codePostal !== undefined) applyStringPatch(update, 'codePostal', p.codePostal);
  if (p.ville !== undefined) applyStringPatch(update, 'ville', p.ville);
  if (p.pays !== undefined) update.pays = String(p.pays || 'France').trim() || 'France';
  if (p.email !== undefined) update.email = String(p.email || '').trim();
  if (p.telephone !== undefined) update.telephone = String(p.telephone || '').trim();
  if (p.siteWeb !== undefined) update.siteWeb = String(p.siteWeb || '').trim();
  if (p.logo !== undefined) update.logo = String(p.logo || '').trim();
  if (p.notes !== undefined) update.notes = String(p.notes || '').trim();
  if (p.gderpiClientId !== undefined) {
    update.gderpiClientId = p.gderpiClientId ? String(p.gderpiClientId).trim() : null;
  }
  if (p.gderpiFournisseurId !== undefined) {
    update.gderpiFournisseurId = p.gderpiFournisseurId ? String(p.gderpiFournisseurId).trim() : null;
  }
  if (p.gderpiBoutiqueId !== undefined) {
    update.gderpiBoutiqueId = p.gderpiBoutiqueId ? String(p.gderpiBoutiqueId).trim() : null;
  }
  if (p.boutiqueOrganisationIds !== undefined) {
    const ids = Array.isArray(p.boutiqueOrganisationIds) ? p.boutiqueOrganisationIds : [];
    const seen = new Set();
    update.boutiqueOrganisationIds = ids
      .map(function (id) { return String(id || '').trim(); })
      .filter(function (id) {
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
  }

  const isCompanyOrg = existing.isOwnEntity || Boolean(existing.gderpiBoutiqueId);
  const touchesIdentity = Object.keys(p).some((key) => IDENTITY_PATCH_KEYS.has(key));
  if (isCompanyOrg && touchesIdentity && !syncFromEntity && !syncFromGderpi) {
    update.identitySource = 'client';
  }

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), organisationId: String(organisationId).trim() },
    { $set: update }
  );

  if (p.isPrimaryCompany === true && isCompanyOrg) {
    await setPrimaryCompanyOrganisation(db, entrepriseId, organisationId);
  }

  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    organisationId: String(organisationId).trim()
  });
  const entry = toOrganisationEntry(doc);

  const mirrorToGdri = isCompanyOrg && touchesIdentity && isGdriMirrorOrg(doc, update);
  if (mirrorToGdri && !syncFromEntity) {
    try {
      await syncOwnOrganisationToEntity(db, entrepriseId);
    } catch (err) {
      console.warn('syncOwnOrganisationToEntity:', err.message);
    }
  }

  if (!syncFromGderpi) {
    try {
      const maybeSyncGderpiFromOrganisation = require('../integrations/gderpi/maybeSyncGderpiFromOrganisation');
      await maybeSyncGderpiFromOrganisation(db, entrepriseId, organisationId);
    } catch (_) {
      /* sync optionnelle */
    }
  }

  return entry;
}

module.exports = updateOrganisation;
