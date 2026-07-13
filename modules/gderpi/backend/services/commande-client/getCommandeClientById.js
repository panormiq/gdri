/**
 * FICHIER : modules/gderpi/backend/services/commande-client/getCommandeClientById.js
 * RÔLE : Récupère une commande client par identifiant (+ consolidation pipeline si exécution terminée).
 */

const fetchCommandeClientEntry = require('./fetchCommandeClientEntry');
const maybeMarkCommandeLivree = require('../workflow/maybeMarkCommandeLivree');

async function getCommandeClientById(db, entrepriseId, commandeClientId, options = {}) {
  const entry = await fetchCommandeClientEntry(db, entrepriseId, commandeClientId);
  if (!entry || options.skipPipelineRepair) return entry;
  return maybeMarkCommandeLivree(db, entrepriseId, commandeClientId, entry);
}

module.exports = getCommandeClientById;
