/**
 * Indique si la commande a terminé son exécution (livraison produits + avancement prestation).
 */

const { commandeClientKind } = require('./commandeClientKind');
const isCommandeFullyDelivered = require('./isCommandeFullyDelivered');
const isCommandeFullyRecetted = require('./isCommandeFullyRecetted');

function isCommandeFulfillmentComplete(commande) {
  const kind = commandeClientKind(commande);
  const delivered = isCommandeFullyDelivered(commande);
  const recetted = isCommandeFullyRecetted(commande);

  if (kind === 'produit') return delivered;
  if (kind === 'dev') return recetted;
  if (kind === 'mixte') return delivered && recetted;
  return delivered || recetted;
}

module.exports = isCommandeFulfillmentComplete;
