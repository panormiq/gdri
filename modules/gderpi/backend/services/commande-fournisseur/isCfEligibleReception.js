/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/isCfEligibleReception.js
 * RÔLE : Indique si une CF peut recevoir des marchandises.
 */

const RECEPTION_STATUTS = new Set(['envoyee', 'confirmee', 'partiellement_recue']);

function isCfEligibleReception(commandeFournisseur) {
  const statut = String(commandeFournisseur?.statut || '');
  return RECEPTION_STATUTS.has(statut);
}

module.exports = isCfEligibleReception;
