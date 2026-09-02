/**
 * FICHIER : modules/gderpi/backend/services/workflow/hasLivrableProductLines.js
 * RÔLE : Indique si au moins une ligne produit peut être livrée au client.
 */

const resolveQuantiteLivrable = require('./resolveQuantiteLivrable');
const isPrestationLine = require('./isPrestationLine');

function isProductLine(line) {
  if (isPrestationLine(line)) return false;
  const t = String(line?.articleType || '').toLowerCase();
  return t === 'produit' || (t !== 'developpement' && t !== 'service');
}

function hasLivrableProductLines(commande) {
  const lignes = Array.isArray(commande?.lignes) ? commande.lignes : [];
  return lignes.some((line) => isProductLine(line) && resolveQuantiteLivrable(line, commande) > 0);
}

function sumLivrableProductQty(commande) {
  const lignes = Array.isArray(commande?.lignes) ? commande.lignes : [];
  return lignes.reduce((sum, line) => {
    if (!isProductLine(line)) return sum;
    return sum + resolveQuantiteLivrable(line, commande);
  }, 0);
}

module.exports = {
  hasLivrableProductLines,
  sumLivrableProductQty
};
