/**
 * Quantité déjà facturée sur une ligne (stockée + historique factures).
 */

const resolveCommandeFactures = require('./resolveCommandeFactures');

function getQuantiteFactureeLine(commande, lineId) {
  const id = String(lineId || '').trim();
  if (!id) return 0;

  const line = (Array.isArray(commande?.lignes) ? commande.lignes : [])
    .find((l) => String(l.id) === id);
  const stored = Number(line?.quantiteFacturee);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored * 10000) / 10000;

  let fromFactures = 0;
  resolveCommandeFactures(commande).forEach((f) => {
    (f.lignes || []).forEach((entry) => {
      if (String(entry.id) === id) fromFactures += Number(entry.quantite) || 0;
    });
  });
  return Math.round(fromFactures * 10000) / 10000;
}

module.exports = getQuantiteFactureeLine;
