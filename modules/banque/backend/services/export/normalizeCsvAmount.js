/**
 * FICHIER : modules/banque/backend/services/export/normalizeCsvAmount.js
 * RÔLE : Normalise un montant (virgule ou point) en chaîne "0.00" pour le CSV Oxygène.
 */

function normalizeCsvAmount(value) {
  const num = Number(String(value ?? '0').replace(',', '.'));
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2);
}

module.exports = normalizeCsvAmount;
