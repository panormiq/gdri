/**
 * FICHIER : modules/gderpi/backend/services/workflow/lineRequiresRecette.js
 * RÔLE : Indique si une ligne dev/service exige un suivi commande (recette avant facture).
 *
 * ENTRÉES : ligne commande / devis
 * SORTIES : boolean
 *
 * DÉPEND DE : —
 * NE PAS : persistance
 *
 * APPELÉ PAR : getQuantiteFacturableLine.js, computeBloquantGdri.js, isCommandeFullyRecetted.js
 */

const isPrestationLine = require('./isPrestationLine');

function lineRequiresRecette(line) {
  if (!isPrestationLine(line)) return false;
  if (line?.gererCommande === true) return true;
  if (line?.gererCommande === false) return false;
  const t = String(line?.articleType || '').toLowerCase();
  return t !== 'developpement';
}

module.exports = lineRequiresRecette;
