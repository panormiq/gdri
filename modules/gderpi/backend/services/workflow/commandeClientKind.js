/**
 * Détecte le type dominant d'une commande client selon les lignes.
 */

function commandeClientKind(commande) {
  const lines = Array.isArray(commande?.lignes) ? commande.lignes : [];
  let hasDev = false;
  let hasProd = false;
  lines.forEach((line) => {
    const t = String(line.articleType || '').trim().toLowerCase();
    if (t === 'developpement' || t === 'service') hasDev = true;
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
    return list.filter((l) => String(l.articleType || '').toLowerCase() === 'produit');
  }
  if (kind === 'dev') {
    return list.filter((l) => {
      const t = String(l.articleType || '').toLowerCase();
      return t === 'developpement' || t === 'service';
    });
  }
  return list;
}

module.exports = { commandeClientKind, filterLinesByKind };
