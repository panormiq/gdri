/**
 * FICHIER : modules/gderpi/backend/services/commande-client/enrichLignesWithQuantiteLivrable.js
 * RÔLE : Ajoute quantiteLivrable (calculé) sur chaque ligne produit pour l'API.
 *
 * ENTRÉES : commande client normalisée
 * SORTIES : lignes enrichies
 *
 * DÉPEND DE : resolveQuantiteLivrable.js, remainingLineQty.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : toCommandeClientEntry.js
 */

const resolveQuantiteLivrable = require('../workflow/resolveQuantiteLivrable');
const remainingLineQty = require('../workflow/remainingLineQty');

function enrichLignesWithQuantiteLivrable(commande) {
  const cmd = commande && typeof commande === 'object' ? commande : {};
  const lignes = Array.isArray(cmd.lignes) ? cmd.lignes : [];

  return lignes.map((line) => ({
    ...line,
    quantiteRestante: remainingLineQty(line),
    quantiteLivrable: resolveQuantiteLivrable(line, cmd)
  }));
}

module.exports = enrichLignesWithQuantiteLivrable;
