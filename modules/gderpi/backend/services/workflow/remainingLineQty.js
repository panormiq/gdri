/**
 * FICHIER : modules/gderpi/backend/services/workflow/remainingLineQty.js
 * RÔLE : Quantité restante à livrer sur une ligne commande.
 */

function remainingLineQty(line) {
  const ordered = Number(line?.quantite) || 0;
  const delivered = Number(line?.quantiteLivree) || 0;
  return Math.max(0, Math.round((ordered - delivered) * 10000) / 10000);
}

module.exports = remainingLineQty;
