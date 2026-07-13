/**
 * FICHIER : modules/annuaire/backend/services/organisations/deleteOrganisation.js
 */

const COLLECTION = 'annuaire_organisations';

async function deleteOrganisation(db, entrepriseId, organisationId) {
  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    organisationId: String(organisationId).trim()
  });
  if (!doc) return false;
  if (doc.isOwnEntity) throw new Error('Impossible de supprimer l\'organisation interne');

  const contactCount = await db.collection('annuaire_contacts').countDocuments({
    entrepriseId: String(entrepriseId),
    organisationId: String(organisationId).trim()
  });
  if (contactCount > 0) {
    throw new Error('Organisation avec contacts — supprimez les contacts d\'abord');
  }

  await db.collection(COLLECTION).deleteOne({
    entrepriseId: String(entrepriseId),
    organisationId: String(organisationId).trim()
  });
  return true;
}

module.exports = deleteOrganisation;
