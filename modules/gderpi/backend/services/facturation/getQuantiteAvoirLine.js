/**
 * Quantité déjà créditée par des avoirs sur une ligne de facture.
 */

const normalizeAvoir = require('./normalizeAvoir');

function getQuantiteAvoirLine(facture, lineId) {
  const id = String(lineId || '').trim();
  if (!id) return 0;

  let total = 0;
  (Array.isArray(facture?.avoirs) ? facture.avoirs : []).forEach((raw) => {
    const avoir = normalizeAvoir(raw);
    (avoir.lignes || []).forEach((entry) => {
      if (String(entry.id) === id) total += Number(entry.quantite) || 0;
    });
  });

  return Math.round(total * 10000) / 10000;
}

module.exports = getQuantiteAvoirLine;
