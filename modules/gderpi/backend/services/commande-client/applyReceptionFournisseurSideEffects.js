/**
 * FICHIER : modules/gderpi/backend/services/commande-client/applyReceptionFournisseurSideEffects.js
 * RÔLE : Met à jour commande client après réception sur une ou plusieurs CF.
 */

const rebuildQuantiteRecueFrsFromCfs = require('./rebuildQuantiteRecueFrsFromCfs');
const maybeAdvanceCommandeAfterReceptionFrs = require('./maybeAdvanceCommandeAfterReceptionFrs');
const maybeAdvanceCommandeAfterCfEnvoyee = require('./maybeAdvanceCommandeAfterCfEnvoyee');
const maybeAdvanceCommandeFromCf = require('./maybeAdvanceCommandeFromCf');

async function applyReceptionFournisseurSideEffects(db, entrepriseId, commandeClientId) {
  if (!commandeClientId) return null;
  await rebuildQuantiteRecueFrsFromCfs(db, entrepriseId, commandeClientId);
  await maybeAdvanceCommandeAfterCfEnvoyee(db, entrepriseId, commandeClientId);
  await maybeAdvanceCommandeAfterReceptionFrs(db, entrepriseId, commandeClientId);
  await maybeAdvanceCommandeFromCf(db, entrepriseId, commandeClientId);
  return null;
}

module.exports = applyReceptionFournisseurSideEffects;
