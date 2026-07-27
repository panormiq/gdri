/**
 * FICHIER : modules/banque/backend/services/export/escapeCsvLabel.js
 * RÔLE : Nettoie et échappe un libellé pour une cellule CSV (guillemets doublés).
 */

function escapeCsvLabel(value) {
  const label = String(value || '').replace(/\s+/g, ' ').trim();
  return `"${label.replace(/"/g, '""')}"`;
}

module.exports = escapeCsvLabel;
