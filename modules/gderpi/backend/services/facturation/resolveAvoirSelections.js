/**
 * Résout les lignes/quantités à créditer depuis le payload API.
 */

const listLignesAvoirables = require('./listLignesAvoirables');

function resolveAvoirSelections(facture, commandeLignes, payload = {}) {
  const avoirables = listLignesAvoirables(facture, commandeLignes);
  if (!avoirables.length) return [];

  const p = payload && typeof payload === 'object' ? payload : {};
  const mode = String(p.mode || '').trim().toLowerCase();

  if (mode === 'complet' || (!Array.isArray(p.lignes) && !Array.isArray(p.ligneIds))) {
    return avoirables.map((b) => ({ id: b.id, quantite: b.quantiteAvoirable }));
  }

  const byId = new Map(avoirables.map((b) => [b.id, b]));
  const rawLignes = Array.isArray(p.lignes) ? p.lignes : [];
  if (rawLignes.length) {
    const selections = [];
    rawLignes.forEach((entry) => {
      const id = String(entry.id || entry.lineId || '').trim();
      const bill = byId.get(id);
      if (!bill) return;
      let qty = Number(entry.quantite);
      if (!Number.isFinite(qty) || qty <= 0) qty = bill.quantiteAvoirable;
      qty = Math.min(qty, bill.quantiteMax);
      if (qty > 0) selections.push({ id, quantite: Math.round(qty * 10000) / 10000 });
    });
    return selections;
  }

  const ligneIds = Array.isArray(p.ligneIds)
    ? p.ligneIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  return ligneIds.map((id) => {
    const bill = byId.get(id);
    if (!bill) return null;
    return { id, quantite: bill.quantiteAvoirable };
  }).filter(Boolean);
}

module.exports = resolveAvoirSelections;
