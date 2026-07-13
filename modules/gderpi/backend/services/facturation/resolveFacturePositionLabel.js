/**
 * Libellé affichage facture partielle / solde (numérotation FAC plate inchangée).
 */

const resolveCommandeFactures = require('./resolveCommandeFactures');
const isCommandeFullyFacturee = require('./isCommandeFullyFacturee');

function factureSortKey(f) {
  const t = f?.date ? new Date(f.date).getTime() : 0;
  return t || String(f?.numero || '');
}

function resolveFacturePositionLabel(commande, factureId) {
  const factures = resolveCommandeFactures(commande)
    .slice()
    .sort((a, b) => {
      const da = factureSortKey(a);
      const db = factureSortKey(b);
      if (da !== db) return da < db ? -1 : 1;
      return String(a.numero).localeCompare(String(b.numero));
    });

  const count = factures.length;
  const idx = factures.findIndex((f) => String(f.id) === String(factureId));
  if (idx < 0 || count <= 1) {
    return { index: 1, count: 1, nature: 'unique', label: null };
  }

  const index = idx + 1;
  const isLast = index === count;
  const fullyFactured = isCommandeFullyFacturee(commande);

  if (isLast && fullyFactured) {
    return {
      index,
      count,
      nature: 'solde',
      label: `Facture de solde (${index}/${count})`
    };
  }

  return {
    index,
    count,
    nature: 'partielle',
    label: `Facture partielle (${index}/${count})`
  };
}

module.exports = resolveFacturePositionLabel;
