/**
 * Détecte le type dominant d'une commande client selon les lignes.
 */

const isPrestationLine = require('./isPrestationLine');

function commandeClientKind(commande) {
  const lines = Array.isArray(commande?.lignes) ? commande.lignes : [];
  let hasDev = false;
  let hasProd = false;
  lines.forEach((line) => {
    const t = String(line.articleType || '').trim().toLowerCase();
    if (isPrestationLine(line)) hasDev = true;
    else if (t === 'produit') hasProd = true;
  });
  if (hasDev && hasProd) return 'mixte';
  if (hasDev) return 'dev';
  if (hasProd) return 'produit';
  return 'autre';
}

function filterLinesByKind(lignes, kind) {
  const list = Array.isArray(lignes) ? lignes : [];
  if (kind === 'produit') {
    return list.filter((l) => {
      if (isPrestationLine(l)) return false;
      return String(l.articleType || '').toLowerCase() === 'produit';
    });
  }
  if (kind === 'dev') {
    return list.filter(isPrestationLine);
  }
  return list;
}

module.exports = { commandeClientKind, filterLinesByKind };
