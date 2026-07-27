/**
 * FICHIER : modules/banque/backend/services/parsing/normalizeDateWithYear.js
 * RÔLE : Complète une date JJ/MM avec l'année du relevé.
 */

function normalizeDateWithYear(dateNoYear, statementYear) {
  const m = String(dateNoYear || '').match(/^(\d{2})\/(\d{2})$/);
  if (!m) return dateNoYear;
  return `${m[1]}/${m[2]}/${statementYear}`;
}

module.exports = normalizeDateWithYear;
