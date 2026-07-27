/**
 * FICHIER : modules/banque/backend/services/parsing/isDebitLabel.js
 * RÔLE : Détermine si un libellé d'opération correspond à un débit.
 */

function isDebitLabel(label) {
  const text = String(label || '').toLowerCase();
  if (/^carte\b|^prlv\b|^cheque\b|^ch[eè]que\b|cotisation|frais|commission|delivengo|trade\s+/i.test(text)) return true;
  return false;
}

module.exports = isDebitLabel;
