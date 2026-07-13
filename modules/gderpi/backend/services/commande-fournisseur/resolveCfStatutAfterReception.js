/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/resolveCfStatutAfterReception.js
 * RÔLE : Détermine le statut CF après enregistrement d'une réception.
 */

const isCommandeFournisseurFullyReceived = require('./isCommandeFournisseurFullyReceived');

const RECEPTION_STATUTS = new Set(['envoyee', 'confirmee', 'partiellement_recue']);

function resolveCfStatutAfterReception(commandeFournisseur) {
  const cf = commandeFournisseur && typeof commandeFournisseur === 'object' ? commandeFournisseur : {};
  if (isCommandeFournisseurFullyReceived(cf)) return 'recue';

  const hasRecue = (cf.lignes || []).some((l) => (Number(l.quantiteRecue) || 0) > 0);
  if (hasRecue) return 'partiellement_recue';

  const current = String(cf.statut || '');
  return RECEPTION_STATUTS.has(current) ? current : 'envoyee';
}

module.exports = resolveCfStatutAfterReception;
