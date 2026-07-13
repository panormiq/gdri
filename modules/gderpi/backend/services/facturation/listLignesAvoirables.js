/**
 * Lignes éligibles à un avoir sur une facture existante.
 */

const getQuantiteAvoirLine = require('./getQuantiteAvoirLine');

function listLignesAvoirables(facture, commandeLignes) {
  const f = facture && typeof facture === 'object' ? facture : {};
  const lignesCmd = Array.isArray(commandeLignes) ? commandeLignes : [];
  const byId = new Map(lignesCmd.map((l) => [String(l.id || ''), l]));
  const items = [];

  (Array.isArray(f.lignes) ? f.lignes : []).forEach((entry) => {
    const id = String(entry.id || entry.lineId || '').trim();
    if (!id) return;

    const onFacture = Number(entry.quantite) || 0;
    if (onFacture <= 0) return;

    const alreadyAvoir = getQuantiteAvoirLine(f, id);
    const quantiteAvoirable = Math.max(0, Math.round((onFacture - alreadyAvoir) * 10000) / 10000);
    if (quantiteAvoirable <= 0) return;

    const line = byId.get(id) || {};
    items.push({
      id,
      line,
      reference: line.reference || '',
      libelle: line.libelle || '',
      quantiteFacture: onFacture,
      quantiteAvoir: alreadyAvoir,
      quantiteAvoirable,
      quantiteMax: quantiteAvoirable
    });
  });

  return items;
}

module.exports = listLignesAvoirables;
