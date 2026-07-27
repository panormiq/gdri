/**
 * FICHIER : modules/banque/backend/services/parsing/normalizeSpaces.js
 * RÔLE : Réduit les espaces multiples et trim une chaîne.
 */

function normalizeSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

module.exports = normalizeSpaces;
