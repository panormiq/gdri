/**
 * Construit les lignes facture avec quantités et montants recalculés.
 */

function buildFactureSnapshotLignes(commandeLignes, selections) {
  const map = new Map(
    (Array.isArray(selections) ? selections : []).map((s) => [
      String(s.id || s.lineId || '').trim(),
      Number(s.quantite) || 0
    ])
  );

  const result = [];
  (Array.isArray(commandeLignes) ? commandeLignes : []).forEach((line) => {
    const id = String(line.id || '').trim();
    const qty = map.get(id);
    if (!id || !qty || qty <= 0) return;

    const prix = Number(line.prixHt) || 0;
    const rem = Number.isFinite(Number(line.remisePct)) ? Math.min(Math.max(Number(line.remisePct), 0), 100) : 0;
    const montantHt = Math.round(qty * prix * (1 - rem / 100) * 100) / 100;

    result.push({
      ...line,
      quantite: qty,
      montantHt
    });
  });

  return result;
}

module.exports = buildFactureSnapshotLignes;
