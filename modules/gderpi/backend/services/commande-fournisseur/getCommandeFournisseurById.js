/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/getCommandeFournisseurById.js
 * RÔLE : Récupère une commande fournisseur par identifiant.
 *
 * ENTRÉES : db, entrepriseId, commandeFournisseurId, options { skipRepair }
 * SORTIES : CommandeFournisseur | null
 *
 * DÉPEND DE : ensureCommandeFournisseurIndexes.js, toCommandeFournisseurEntry.js, repairCommandeFournisseurPrixAchat.js
 * NE PAS : liste
 *
 * APPELÉ PAR : workflowController
 */

const ensureCommandeFournisseurIndexes = require('./ensureCommandeFournisseurIndexes');
const toCommandeFournisseurEntry = require('./toCommandeFournisseurEntry');

const COLLECTION = 'gderpi_commandes_fournisseur';

async function getCommandeFournisseurById(db, entrepriseId, commandeFournisseurId, options = {}) {
  await ensureCommandeFournisseurIndexes(db);
  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    commandeFournisseurId: String(commandeFournisseurId).trim()
  });
  const entry = toCommandeFournisseurEntry(doc);
  if (!entry || options.skipRepair === true) return entry;
  if (String(entry.statut) !== 'brouillon') return entry;

  const repairCommandeFournisseurPrixAchat = require('./repairCommandeFournisseurPrixAchat');
  return repairCommandeFournisseurPrixAchat(db, entrepriseId, entry);
}

module.exports = getCommandeFournisseurById;
