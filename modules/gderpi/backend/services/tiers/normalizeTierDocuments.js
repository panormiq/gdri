/**
 * FICHIER : modules/gderpi/backend/services/tiers/normalizeTierDocuments.js
 * RÔLE : Normalise un tableau de pièces jointes tiers.
 */

const { normalizeTierDocument } = require('./normalizeTierDocument');

function normalizeTierDocuments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeTierDocument).filter((d) => d.filename && d.scope);
}

module.exports = normalizeTierDocuments;
