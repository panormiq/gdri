/**
 * FICHIER : modules/banque/backend/services/parsing/isCreditLabel.js
 * RÔLE : Détermine si un libellé d'opération correspond à un crédit.
 */

function isCreditLabel(label) {
  const text = String(label || '').toLowerCase();
  if (/virement\s+frais/i.test(text)) return false;
  if (/remise|versement|virement\s+recu|virement\s+reçu|virement\s+ebay|virement/i.test(text)) return true;
  return false;
}

module.exports = isCreditLabel;
