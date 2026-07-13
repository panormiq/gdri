/**
 * FICHIER : modules/annuaire/backend/services/organisations/getCompanyOrganisation.js
 * RÔLE : Organisation « notre entreprise » (siège ou boutique GDERPI principale).
 */

const ensureInternalOrganisation = require('./ensureInternalOrganisation');
const toOrganisationEntry = require('./toOrganisationEntry');

const COLLECTION = 'annuaire_organisations';
const BOUTIQUE_COL = 'gderpi_boutiques';

function boutiqueActifMap(boutiques) {
  const map = new Map();
  (Array.isArray(boutiques) ? boutiques : []).forEach((b) => {
    map.set(String(b.boutiqueId), b.actif !== false);
  });
  return map;
}

function pickCompanyOrganisationDoc(ownDoc, boutiqueOrgs, actifByBoutiqueId) {
  if (ownDoc) return ownDoc;
  const orgs = Array.isArray(boutiqueOrgs) ? boutiqueOrgs : [];
  if (!orgs.length) return null;

  const primary = orgs.find((o) => o.isPrimaryCompany === true);
  if (primary) return primary;

  const activeOrg = orgs.find((o) => {
    const bid = String(o.gderpiBoutiqueId || '');
    return bid && actifByBoutiqueId.get(bid) !== false;
  });
  if (activeOrg) return activeOrg;

  return orgs.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  })[0] || null;
}

async function getCompanyOrganisationDoc(db, entrepriseId) {
  const eid = String(entrepriseId);
  if (!eid || eid === 'SYSTEM') return null;

  await ensureInternalOrganisation(db, eid);

  const ownDoc = await db.collection(COLLECTION).findOne({ entrepriseId: eid, isOwnEntity: true });
  const boutiqueOrgs = await db.collection(COLLECTION)
    .find({ entrepriseId: eid, gderpiBoutiqueId: { $ne: null } })
    .sort({ isPrimaryCompany: -1, updatedAt: -1, createdAt: 1 })
    .toArray();

  if (boutiqueOrgs.length) {
    const boutiques = await db.collection(BOUTIQUE_COL).find({ entrepriseId: eid }).toArray();
    const actifMap = boutiqueActifMap(boutiques);
    return pickCompanyOrganisationDoc(null, boutiqueOrgs, actifMap);
  }

  return ownDoc;
}

async function getCompanyOrganisation(db, entrepriseId) {
  const doc = await getCompanyOrganisationDoc(db, entrepriseId);
  return doc ? toOrganisationEntry(doc) : null;
}

module.exports = {
  getCompanyOrganisation,
  getCompanyOrganisationDoc,
  pickCompanyOrganisationDoc
};
