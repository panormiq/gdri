/**
 * Passe la commande en « livrée » quand livraison produit et avancement prestation sont complets.
 */

const fetchCommandeClientEntry = require('../commande-client/fetchCommandeClientEntry');
const setCommandeClientStatut = require('../commande-client/setCommandeClientStatut');
const isCommandeFulfillmentComplete = require('./isCommandeFulfillmentComplete');

const ADVANCEABLE_STATUTS = new Set([
  'validee_gdri',
  'prestation_en_cours',
  'achats_en_cours',
  'attente_livraison_frs',
  'a_livrer'
]);

async function maybeMarkCommandeLivree(db, entrepriseId, commandeClientId, commande = null) {
  const cmd = commande || await fetchCommandeClientEntry(db, entrepriseId, commandeClientId);
  if (!cmd) return null;
  if (!ADVANCEABLE_STATUTS.has(cmd.statut)) return cmd;
  if (!isCommandeFulfillmentComplete(cmd)) return cmd;

  await setCommandeClientStatut(db, entrepriseId, commandeClientId, 'livree', {
    historique: { action: 'execution_terminee' }
  });
  return fetchCommandeClientEntry(db, entrepriseId, commandeClientId);
}

module.exports = maybeMarkCommandeLivree;
