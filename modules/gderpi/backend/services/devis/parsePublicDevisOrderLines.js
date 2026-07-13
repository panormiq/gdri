/**
 * Parse les lignes soumises depuis le formulaire public de confirmation de commande.
 */

function parsePublicDevisOrderLines(devisLignes, body) {
  const source = Array.isArray(devisLignes) ? devisLignes : [];
  const submitted = body?.lignes;
  let rows = [];

  if (Array.isArray(submitted)) {
    rows = submitted;
  } else if (submitted && typeof submitted === 'object') {
    rows = Object.keys(submitted)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => submitted[key]);
  }

  const byId = new Map();
  rows.forEach((row) => {
    const id = String(row?.id || '').trim();
    if (id) byId.set(id, row);
  });

  const result = [];
  for (const line of source) {
    const row = byId.get(String(line.id || '').trim());
    if (!row) continue;
    const qty = Number(row.quantite);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    result.push({ ...line, quantite: Math.round(qty * 10000) / 10000 });
  }
  return result;
}

module.exports = parsePublicDevisOrderLines;
