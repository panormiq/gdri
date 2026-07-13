/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/getCommandeFournisseurById.js
 * RÔLE : Récupère une commande fournisseur par identifiant.
 *
 * ENTRÉES : db, entrepriseId, commandeFournisseurId
 * SORTIES : CommandeFournisseur | null
 *
 * DÉPEND DE : ensureCommandeFournisseurIndexes.js, toCommandeFournisseurEntry.js
 * NE PAS : liste
 *
 * APPELÉ PAR : workflowController
 */

const ensureCommandeFournisseurIndexes = require('./ensureCommandeFournisseurIndexes');
const toCommandeFournisseurEntry = require('./toCommandeFournisseurEntry');

const COLLECTION = 'gderpi_commandes_fournisseur';

async function getCommandeFournisseurById(db, entrepriseId, commandeFournisseurId) {
  await ensureCommandeFournisseurIndexes(db);
  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    commandeFournisseurId: String(commandeFournisseurId).trim()
  });
  return toCommandeFournisseurEntry(doc);
}

module.exports = getCommandeFournisseurById;
