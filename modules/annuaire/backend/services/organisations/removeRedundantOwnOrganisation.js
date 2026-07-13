/**
 * FICHIER : modules/annuaire/backend/services/organisations/removeRedundantOwnOrganisation.js
 * RÔLE : Supprime le stub « siège » si des boutiques GDERPI existent (évite le doublon de nom).
 */

const ORG_COL = 'annuaire_organisations';
const CONTACT_COL = 'annuaire_contacts';
const SERVICE_COL = 'annuaire_services';

async function removeRedundantOwnOrganisation(db, entrepriseId) {
  const eid = String(entrepriseId);
  const own = await db.collection(ORG_COL).findOne({ entrepriseId: eid, isOwnEntity: true });
  if (!own) return false;

  const boutiqueOrg = await db.collection(ORG_COL).findOne(
    { entrepriseId: eid, gderpiBoutiqueId: { $ne: null } },
    { sort: { createdAt: 1, raisonSociale: 1 } }
  );
  if (!boutiqueOrg) return false;

  const targetOrgId = boutiqueOrg.organisationId;
  const now = new Date();

  await db.collection(CONTACT_COL).updateMany(
    { entrepriseId: eid, organisationId: own.organisationId },
    { $set: { organisationId: targetOrgId, updatedAt: now } }
  );
  await db.collection(SERVICE_COL).updateMany(
    { entrepriseId: eid, organisationId: own.organisationId },
    { $set: { organisationId: targetOrgId, updatedAt: now } }
  );

  await db.collection(ORG_COL).deleteOne({ _id: own._id });
  return true;
}

module.exports = removeRedundantOwnOrganisation;
