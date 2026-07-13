/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/enrichLignesWithReceptionCf.js
 * RÔLE : Ajoute quantiteRestante sur les lignes CF pour l'API.
 */

const remainingCfLineQty = require('../workflow/remainingCfLineQty');

function enrichLignesWithReceptionCf(commandeFournisseur) {
  const cf = commandeFournisseur && typeof commandeFournisseur === 'object' ? commandeFournisseur : {};
  const lignes = Array.isArray(cf.lignes) ? cf.lignes : [];
  return lignes.map((line) => ({
    ...line,
    quantiteRestante: remainingCfLineQty(line)
  }));
}

module.exports = enrichLignesWithReceptionCf;
