/**
 * FICHIER : modules/annuaire/backend/services/organisations/listOrganisations.js
 */

const ensureOrganisationIndexes = require('./ensureOrganisationIndexes');
const ensureInternalOrganisation = require('./ensureInternalOrganisation');
const toOrganisationEntry = require('./toOrganisationEntry');

const COLLECTION = 'annuaire_organisations';

async function listOrganisations(db, entrepriseId, options = {}) {
  await ensureOrganisationIndexes(db);
  await ensureInternalOrganisation(db, entrepriseId);

  const filter = { entrepriseId: String(entrepriseId) };
  if (options.scope) filter.scope = String(options.scope);
  if (options.role) filter.roles = String(options.role);
  if (options.search) {
    const q = String(options.search).trim();
    if (q) {
      filter.$or = [
        { raisonSociale: { $regex: q, $options: 'i' } },
        { prenom: { $regex: q, $options: 'i' } },
        { nom: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { siret: { $regex: q, $options: 'i' } }
      ];
    }
  }

  const docs = await db.collection(COLLECTION)
    .find(filter)
    .sort({ gderpiBoutiqueId: -1, isOwnEntity: -1, raisonSociale: 1, nom: 1 })
    .toArray();
  return docs.map(toOrganisationEntry);
}

module.exports = listOrganisations;
