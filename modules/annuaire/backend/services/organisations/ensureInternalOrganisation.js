/**
 * FICHIER : modules/annuaire/backend/services/organisations/ensureInternalOrganisation.js
 * RÔLE : Crée le stub interne uniquement sans GDERPI boutique ; sinon nettoie le doublon siège.
 */

const seedOwnOrganisation = require('./seedOwnOrganisation');
const syncOwnOrganisationFromEntity = require('./syncOwnOrganisationFromEntity');
const hasGderpiBoutiques = require('./hasGderpiBoutiques');
const removeRedundantOwnOrganisation = require('./removeRedundantOwnOrganisation');

async function ensureInternalOrganisation(db, entrepriseId) {
  if (await hasGderpiBoutiques(db, entrepriseId)) {
    await removeRedundantOwnOrganisation(db, entrepriseId);
    return null;
  }
  const org = await seedOwnOrganisation(db, entrepriseId);
  await syncOwnOrganisationFromEntity(db, entrepriseId);
  return org;
}

module.exports = ensureInternalOrganisation;
