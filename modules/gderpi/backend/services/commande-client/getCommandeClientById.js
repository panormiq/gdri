/**
 * FICHIER : modules/gderpi/backend/services/commande-client/getCommandeClientById.js
 * RÔLE : Récupère une commande client par identifiant (+ consolidation pipeline si exécution terminée).
 */

const fetchCommandeClientEntry = require('./fetchCommandeClientEntry');
const maybeMarkCommandeLivree = require('../workflow/maybeMarkCommandeLivree');
const commandeNeedsDevSuiviRepair = require('./commandeNeedsDevSuiviRepair');
const repairCommandeClientDevSuivi = require('./repairCommandeClientDevSuivi');
const maybeRemapAchatsToPrestation = require('./maybeRemapAchatsToPrestation');

async function getCommandeClientById(db, entrepriseId, commandeClientId, options = {}) {
  let entry = await fetchCommandeClientEntry(db, entrepriseId, commandeClientId);
  if (!entry || options.skipPipelineRepair) return entry;
  if (commandeNeedsDevSuiviRepair(entry)) {
    await repairCommandeClientDevSuivi(db, entrepriseId, commandeClientId);
    entry = await fetchCommandeClientEntry(db, entrepriseId, commandeClientId);
  }
  if (String(entry.statut) === 'achats_en_cours') {
    entry = await maybeRemapAchatsToPrestation(db, entrepriseId, commandeClientId, entry);
  }
  return maybeMarkCommandeLivree(db, entrepriseId, commandeClientId, entry);
}

module.exports = getCommandeClientById;
