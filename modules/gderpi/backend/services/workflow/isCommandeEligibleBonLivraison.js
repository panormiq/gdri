/**
 * FICHIER : modules/gderpi/backend/services/workflow/isCommandeEligibleBonLivraison.js
 * RÔLE : Indique si une commande client peut recevoir un bon de livraison.
 *
 * ENTRÉES : commande client
 * SORTIES : boolean
 *
 * DÉPEND DE : hasLivrableProductLines.js
 * NE PAS : persistance
 *
 * APPELÉ PAR : createBonLivraison.js
 */

const { hasLivrableProductLines } = require('./hasLivrableProductLines');

const ELIGIBLE_STATUTS = new Set(['a_livrer', 'livree']);
const EXECUTION_STATUTS = new Set(['achats_en_cours', 'attente_livraison_frs']);

function isCommandeEligibleBonLivraison(commande) {
  const statut = String(commande?.statut || '');
  if (['annulee', 'facturee', 'validee_client', 'a_valider_gdri'].includes(statut)) return false;
  if (ELIGIBLE_STATUTS.has(statut)) return true;
  return EXECUTION_STATUTS.has(statut) && hasLivrableProductLines(commande);
}

module.exports = isCommandeEligibleBonLivraison;
