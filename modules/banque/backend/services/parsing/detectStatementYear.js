/**
 * FICHIER : modules/banque/backend/services/parsing/detectStatementYear.js
 * RÔLE : Détecte l'année du relevé via la ligne "Date d'arrêté", sinon année courante.
 */

function detectStatementYear(lines) {
  for (const line of lines) {
    const m = line.match(/Date d[' ]arr[êe]t[ée]\s*:\s*.*?(\d{4})/i);
    if (m) return m[1];
  }
  return String(new Date().getFullYear());
}

module.exports = detectStatementYear;
