/**
 * FICHIER : modules/gderpi/backend/services/pdf/formatMoneyFr.js
 * RÔLE : Formate un montant en euros (format FR).
 *
 * ENTRÉES : nombre
 * SORTIES : string « 1 234,56 € »
 *
 * DÉPEND DE : —
 * NE PAS : échappement HTML
 *
 * APPELÉ PAR : renderDevisHtml.js
 */

function formatMoneyFr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0,00 €';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

module.exports = formatMoneyFr;
