/**
 * FICHIER : modules/gderpi/backend/services/commande-client/applyQuantiteLivree.js
 * RÔLE : Met à jour quantiteLivree sur les lignes commande après un BL.
 */

const remainingLineQty = require('../workflow/remainingLineQty');

function applyQuantiteLivree(lignes, blLignes) {
  const list = Array.isArray(lignes) ? lignes.map((l) => ({ ...l })) : [];
  const deliveries = Array.isArray(blLignes) ? blLignes : [];

  deliveries.forEach((blLine) => {
    const qty = Number(blLine.quantite) || 0;
    if (qty <= 0) return;

    const lineId = String(blLine.id || blLine.lineId || '').trim();
    const sourceDevisLineId = String(blLine.sourceDevisLineId || blLine.devisLineId || '').trim();
    const ref = String(blLine.reference || '').trim();
    const libelle = String(blLine.libelle || '').trim();
    const articleId = String(blLine.articleId || '').trim();
    const blIndex = Number(blLine.blIndex);

    const idx = list.findIndex((l, index) => {
      if (lineId && String(l.id) === lineId) return true;
      if (lineId && String(l.lineId) === lineId) return true;
      if (sourceDevisLineId && (String(l.id) === sourceDevisLineId || String(l.sourceDevisLineId) === sourceDevisLineId)) {
        return true;
      }
      if (ref && libelle && l.reference === ref && l.libelle === libelle) return true;
      if (libelle && !ref && l.libelle === libelle) return true;
      if (articleId && String(l.articleId || '').trim() === articleId) {
        if (!ref && !libelle) return true;
        if (ref && l.reference === ref) return true;
        if (libelle && l.libelle === libelle) return true;
      }
      if (Number.isFinite(blIndex) && index === blIndex) return true;
      return false;
    });
    if (idx < 0) return;

    const current = Number(list[idx].quantiteLivree) || 0;
    list[idx].quantiteLivree = Math.round((current + qty) * 10000) / 10000;
  });

  return list;
}

module.exports = applyQuantiteLivree;
