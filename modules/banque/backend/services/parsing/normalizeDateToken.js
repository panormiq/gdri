/**
 * FICHIER : modules/banque/backend/services/parsing/normalizeDateToken.js
 * RÔLE : Normalise un jeton de date (JJ.MM, JJ-MM-AA…) en JJ/MM ou JJ/MM/AAAA.
 */

function normalizeDateToken(token) {
  const match = String(token || '').match(/^(\d{2})[./-](\d{2})(?:[./-](\d{2,4}))?$/);
  if (!match) return null;
  const day = match[1];
  const month = match[2];
  let year = match[3] || '';
  if (!year) return `${day}/${month}`;
  if (year.length === 2) year = `20${year}`;
  return `${day}/${month}/${year}`;
}

module.exports = normalizeDateToken;
