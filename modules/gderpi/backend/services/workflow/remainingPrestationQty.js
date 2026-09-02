/**
 * FICHIER : modules/gderpi/backend/services/workflow/remainingPrestationQty.js
 * RÔLE : Quantité de prestation encore à livrer sur une ligne.
 *
 * ENTRÉES : ligne commande
 * SORTIES : number
 *
 * DÉPEND DE : —
 * NE PAS : persistance
 *
 * APPELÉ PAR : applyAvancementLignes.js, isCommandeFullyRecetted.js, canRecordAvancement.js
 */

function remainingPrestationQty(line) {
  if (!line) return 0;
  if (line.recetteValideeAt) return 0;
  const ordered = Number(line.quantite) || 0;
  const livree = Number(line.quantiteLivree) || 0;
  return Math.max(0, Math.round((ordered - livree) * 10000) / 10000);
}

module.exports = remainingPrestationQty;
