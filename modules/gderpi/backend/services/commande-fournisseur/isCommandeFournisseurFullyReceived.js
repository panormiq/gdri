/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/isCommandeFournisseurFullyReceived.js
 * RÔLE : Indique si toutes les lignes CF sont entièrement reçues.
 */

const remainingCfLineQty = require('../workflow/remainingCfLineQty');

function isCommandeFournisseurFullyReceived(commandeFournisseur) {
  const lines = Array.isArray(commandeFournisseur?.lignes) ? commandeFournisseur.lignes : [];
  if (!lines.length) return false;
  return lines.every((line) => remainingCfLineQty(line) <= 0);
}

module.exports = isCommandeFournisseurFullyReceived;
