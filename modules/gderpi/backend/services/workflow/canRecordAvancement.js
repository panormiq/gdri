/**
 * Indique si une commande client peut recevoir un avancement (prestation / développement).
 */

const { commandeClientKind } = require('./commandeClientKind');
const { filterLinesByKind } = require('./commandeClientKind');

const BLOCKED_STATUTS = new Set(['annulee', 'facturee', 'validee_client', 'a_valider_gdri']);
const ALLOWED_STATUTS = new Set([
  'validee_gdri',
  'achats_en_cours',
  'attente_livraison_frs',
  'a_livrer',
  'livree',
  'a_facturer',
  'facturee_partiellement'
]);

function remainingDevLines(commande) {
  return filterLinesByKind(commande?.lignes, 'dev').filter((l) => !l.recetteValideeAt);
}

function canRecordAvancement(commande) {
  if (!commande) return false;
  const statut = String(commande.statut || '');
  if (BLOCKED_STATUTS.has(statut)) return false;
  if (!ALLOWED_STATUTS.has(statut)) return false;
  if (commandeClientKind(commande) === 'produit') return false;
  return remainingDevLines(commande).length > 0;
}

module.exports = { canRecordAvancement, remainingDevLines, ALLOWED_STATUTS, BLOCKED_STATUTS };
