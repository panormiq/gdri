/**
 * FICHIER : modules/gderpi/backend/services/workflow/remainingCfLineQty.js
 * RÔLE : Quantité restante à recevoir sur une ligne commande fournisseur.
 */

function remainingCfLineQty(line) {
  const ordered = Number(line?.quantite) || 0;
  const recue = Number(line?.quantiteRecue) || 0;
  return Math.max(0, Math.round((ordered - recue) * 10000) / 10000);
}

module.exports = remainingCfLineQty;
