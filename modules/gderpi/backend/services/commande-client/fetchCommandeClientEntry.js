/**
 * Charge une commande client sans réparation automatique du pipeline.
 */

const ensureCommandeClientIndexes = require('./ensureCommandeClientIndexes');
const toCommandeClientEntry = require('./toCommandeClientEntry');
const { summarizeCommandesFournisseurForClient } = require('../commande-fournisseur/summarizeCommandesFournisseurByClient');

const COLLECTION = 'gderpi_commandes_client';

async function fetchCommandeClientEntry(db, entrepriseId, commandeClientId, opts = {}) {
  await ensureCommandeClientIndexes(db);
  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    commandeClientId: String(commandeClientId).trim()
  });
  if (!doc) return null;

  let cfSummary = opts.cfSummary;
  if (!cfSummary) {
    cfSummary = await summarizeCommandesFournisseurForClient(db, entrepriseId, commandeClientId);
  }

  return toCommandeClientEntry(doc, cfSummary);
}

module.exports = fetchCommandeClientEntry;
