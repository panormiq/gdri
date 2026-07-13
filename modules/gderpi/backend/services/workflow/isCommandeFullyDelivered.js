/**
 * FICHIER : modules/gderpi/backend/services/workflow/isCommandeFullyDelivered.js
 * RÔLE : Indique si toutes les lignes produit sont entièrement livrées.
 */

const { commandeClientKind, filterLinesByKind } = require('./commandeClientKind');
const remainingLineQty = require('./remainingLineQty');

function isCommandeFullyDelivered(commande) {
  const kind = commandeClientKind(commande);
  if (kind === 'dev') return true;

  let lines = filterLinesByKind(commande?.lignes, 'produit');
  if (!lines.length && kind !== 'produit') {
    lines = (commande?.lignes || []).filter((l) => {
      const t = String(l.articleType || '').toLowerCase();
      return t !== 'developpement' && t !== 'service';
    });
  }
  if (!lines.length) return kind !== 'produit' && kind !== 'mixte';

  return lines.every((line) => remainingLineQty(line) <= 0);
}

module.exports = isCommandeFullyDelivered;
