/**
 * Décrémente quantiteFacturee sur les lignes commande après émission d'un avoir.
 */

function applyAvoirQuantites(lignes, selections) {
  const map = new Map(
    (Array.isArray(selections) ? selections : []).map((s) => [
      String(s.id || s.lineId || '').trim(),
      Number(s.quantite) || 0
    ])
  );

  return (Array.isArray(lignes) ? lignes : []).map((line) => {
    const id = String(line.id || '').trim();
    const sub = map.get(id);
    if (!sub || sub <= 0) return line;
    const prev = Number(line.quantiteFacturee) || 0;
    return {
      ...line,
      quantiteFacturee: Math.max(0, Math.round((prev - sub) * 10000) / 10000)
    };
  });
}

module.exports = applyAvoirQuantites;
