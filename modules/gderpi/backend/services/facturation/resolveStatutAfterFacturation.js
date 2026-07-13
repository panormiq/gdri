/**
 * Statut commande après émission d'une facture (partielle ou complète).
 */

const isCommandeFullyFacturee = require('./isCommandeFullyFacturee');
const isCommandeFulfillmentComplete = require('../workflow/isCommandeFulfillmentComplete');

function resolveStatutAfterFacturation(commande) {
  if (isCommandeFullyFacturee(commande)) return 'facturee';
  if (isCommandeFulfillmentComplete(commande)) return 'facturee_partiellement';
  const current = String(commande?.statut || '');
  if (['livree', 'a_facturer'].includes(current)) return 'facturee_partiellement';
  return current;
}

module.exports = resolveStatutAfterFacturation;
