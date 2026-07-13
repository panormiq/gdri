/**
 * Incrémente quantiteFacturee sur les lignes commande après émission facture.
 */

function applyFactureQuantites(lignes, selections) {
  const map = new Map(
    (Array.isArray(selections) ? selections : []).map((s) => [
      String(s.id || s.lineId || '').trim(),
      Number(s.quantite) || 0
    ])
  );

  return (Array.isArray(lignes) ? lignes : []).map((line) => {
    const id = String(line.id || '').trim();
    const add = map.get(id);
    if (!add || add <= 0) return line;
    const prev = Number(line.quantiteFacturee) || 0;
    return {
      ...line,
      quantiteFacturee: Math.round((prev + add) * 10000) / 10000
    };
  });
}

module.exports = applyFactureQuantites;
