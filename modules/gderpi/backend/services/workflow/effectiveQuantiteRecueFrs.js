/**
 * FICHIER : modules/gderpi/backend/services/workflow/effectiveQuantiteRecueFrs.js
 * RÔLE : Retourne la quantité reçue fournisseur effective (avec repli données legacy).
 *
 * ENTRÉES : ligne commande, commande client
 * SORTIES : nombre >= 0
 *
 * DÉPEND DE : lineRequiresReceptionFrs.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : resolveQuantiteLivrable.js
 */

const lineRequiresReceptionFrs = require('./lineRequiresReceptionFrs');

function effectiveQuantiteRecueFrs(line, commande) {
  const recue = Number(line?.quantiteRecueFrs) || 0;
  if (recue > 0) return recue;
  if (!lineRequiresReceptionFrs(line, commande)) return 0;

  const statut = String(commande?.statut || '');
  if (['a_livrer', 'livree', 'a_facturer', 'facturee'].includes(statut)) {
    return Number(line?.quantite) || 0;
  }
  return 0;
}

module.exports = effectiveQuantiteRecueFrs;
