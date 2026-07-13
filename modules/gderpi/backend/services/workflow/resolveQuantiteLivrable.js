/**
 * FICHIER : modules/gderpi/backend/services/workflow/resolveQuantiteLivrable.js
 * RÔLE : Calcule la quantité maximale livrable au client sur une ligne produit.
 *
 * ENTRÉES : ligne commande, commande client
 * SORTIES : nombre >= 0
 *
 * DÉPEND DE : remainingLineQty.js, lineRequiresReceptionFrs.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : enrichLignesWithQuantiteLivrable.js, createBonLivraison.js
 */

const remainingLineQty = require('./remainingLineQty');
const lineRequiresReceptionFrs = require('./lineRequiresReceptionFrs');
const effectiveQuantiteRecueFrs = require('./effectiveQuantiteRecueFrs');

function roundQty(value) {
  return Math.max(0, Math.round(Number(value) * 10000) / 10000);
}

function resolveQuantiteLivrable(line, commande) {
  const resteCommande = remainingLineQty(line);
  if (resteCommande <= 0) return 0;

  if (!lineRequiresReceptionFrs(line, commande)) {
    return resteCommande;
  }

  const recue = effectiveQuantiteRecueFrs(line, commande);
  const livree = Number(line?.quantiteLivree) || 0;
  const dispoRecue = roundQty(recue - livree);

  return roundQty(Math.min(resteCommande, dispoRecue));
}

module.exports = resolveQuantiteLivrable;
