/**
 * FICHIER : modules/gderpi/backend/services/pdf/renderDevisPaymentSection.js
 * RÔLE : Bloc conditions de paiement du devis (corps du document).
 */

const escapeHtmlText = require('./escapeHtmlText');
const { labelMoyen, labelEcheance } = require('../devis/devisConditionsPaiementOptions');

const esc = escapeHtmlText;

function renderDevisPaymentSection(devis) {
  const d = devis || {};
  const moyen = labelMoyen(d.conditionsPaiementMoyen);
  const echeance = labelEcheance(d.conditionsPaiementEcheance);
  const complement = String(d.conditionsPaiementComplement || '').trim();

  if (!moyen && !echeance && !complement) return '';

  const lines = [];
  if (moyen) lines.push('<div>Moyen de paiement : ' + esc(moyen) + '</div>');
  if (echeance) lines.push('<div>Échéance : ' + esc(echeance) + '</div>');
  if (complement) {
    lines.push('<div class="gderpi-devis-doc__payment-complement">' + esc(complement).replace(/\n/g, '<br>') + '</div>');
  }

  return '<section class="gderpi-devis-doc__payment-terms">' +
    '<div class="gderpi-devis-doc__payment-terms-title"><strong>Conditions de paiement :</strong></div>' +
    lines.join('') +
    '</section>';
}

module.exports = renderDevisPaymentSection;
