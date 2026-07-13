/**
 * FICHIER : modules/annuaire/backend/services/organisations/setPrimaryCompanyOrganisation.js
 * RÔLE : Définit l'organisation « entreprise principale » (siège ou boutique GDERPI).
 */

const ORG_COL = 'annuaire_organisations';
const BOUTIQUE_COL = 'gderpi_boutiques';

async function setPrimaryCompanyOrganisation(db, entrepriseId, organisationId) {
  const eid = String(entrepriseId);
  const orgId = String(organisationId || '').trim();
  if (!orgId) return null;

  const org = await db.collection(ORG_COL).findOne({ entrepriseId: eid, organisationId: orgId });
  if (!org || (!org.isOwnEntity && !org.gderpiBoutiqueId)) {
    return null;
  }

  const now = new Date();
  await db.collection(ORG_COL).updateMany(
    {
      entrepriseId: eid,
      $or: [{ isOwnEntity: true }, { gderpiBoutiqueId: { $ne: null } }]
    },
    { $set: { isPrimaryCompany: false, updatedAt: now } }
  );
  await db.collection(ORG_COL).updateOne(
    { _id: org._id },
    { $set: { isPrimaryCompany: true, updatedAt: now } }
  );

  if (org.gderpiBoutiqueId) {
    await db.collection(BOUTIQUE_COL).updateMany(
      { entrepriseId: eid },
      { $set: { isPrincipale: false, updatedAt: now } }
    );
    await db.collection(BOUTIQUE_COL).updateOne(
      { entrepriseId: eid, boutiqueId: String(org.gderpiBoutiqueId) },
      { $set: { isPrincipale: true, updatedAt: now } }
    );
  }

  return org;
}

module.exports = setPrimaryCompanyOrganisation;
