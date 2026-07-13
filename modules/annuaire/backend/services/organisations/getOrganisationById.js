/**
 * FICHIER : modules/annuaire/backend/services/organisations/getOrganisationById.js
 */

const ensureOrganisationIndexes = require('./ensureOrganisationIndexes');
const toOrganisationEntry = require('./toOrganisationEntry');

async function getOrganisationById(db, entrepriseId, organisationId) {
  await ensureOrganisationIndexes(db);
  const doc = await db.collection('annuaire_organisations').findOne({
    entrepriseId: String(entrepriseId),
    organisationId: String(organisationId).trim()
  });
  return toOrganisationEntry(doc);
}

module.exports = getOrganisationById;
