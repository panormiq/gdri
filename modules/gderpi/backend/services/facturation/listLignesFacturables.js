/**
 * Lignes éligibles à une facture (partielle ou complète).
 */

const getQuantiteFacturableLine = require('./getQuantiteFacturableLine');

function listLignesFacturables(commande) {
  const lignes = Array.isArray(commande?.lignes) ? commande.lignes : [];
  const items = [];

  lignes.forEach((line) => {
    const quantiteFacturable = getQuantiteFacturableLine(commande, line);
    if (quantiteFacturable <= 0) return;
    items.push({
      id: String(line.id),
      line,
      quantiteFacturable,
      quantiteMax: quantiteFacturable
    });
  });

  return items;
}

module.exports = listLignesFacturables;
