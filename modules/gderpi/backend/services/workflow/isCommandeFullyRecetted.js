/**
 * FICHIER : modules/gderpi/backend/services/workflow/isCommandeFullyRecetted.js
 * RÔLE : Indique si toutes les lignes développement/service ont une recette validée.
 */

const { commandeClientKind, filterLinesByKind } = require('./commandeClientKind');
const remainingPrestationQty = require('./remainingPrestationQty');

function isCommandeFullyRecetted(commande) {
  const kind = commandeClientKind(commande);
  if (kind === 'produit') return true;

  const lines = filterLinesByKind(commande?.lignes, 'dev');
  if (!lines.length) return kind !== 'dev' && kind !== 'mixte';

  if (lines.every((line) => remainingPrestationQty(line) <= 0)) return true;

  // Avancement global enregistré mais lignes non resynchronisées
  if (commande?.recetteValideeAt) {
    const pending = lines.filter((l) => !l.recetteValideeAt).length;
    if (!pending) return true;
  }

  return false;
}

module.exports = isCommandeFullyRecetted;
