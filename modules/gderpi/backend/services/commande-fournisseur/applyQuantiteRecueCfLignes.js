/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/applyQuantiteRecueCfLignes.js
 * RÔLE : Incrémente quantiteRecue sur les lignes CF après une réception.
 */

function roundQty(value) {
  return Math.round(Number(value) * 10000) / 10000;
}

function applyQuantiteRecueCfLignes(lignes, receptionLignes) {
  const list = Array.isArray(lignes) ? lignes.map((l) => ({ ...l })) : [];
  const deliveries = Array.isArray(receptionLignes) ? receptionLignes : [];

  deliveries.forEach((raw) => {
    const qty = Number(raw.quantite) || 0;
    if (qty <= 0) return;

    const lineId = String(raw.id || raw.lineId || '').trim();
    const ref = String(raw.reference || '').trim();
    const libelle = String(raw.libelle || '').trim();
    const articleId = raw.articleId != null ? String(raw.articleId).trim() : '';

    const idx = list.findIndex((l) => {
      if (lineId && String(l.id) === lineId) return true;
      if (articleId && String(l.articleId || '').trim() === articleId) return true;
      if (ref && libelle) return l.reference === ref && l.libelle === libelle;
      return false;
    });
    if (idx < 0) return;

    const current = Number(list[idx].quantiteRecue) || 0;
    list[idx].quantiteRecue = roundQty(current + qty);
  });

  return list;
}

module.exports = applyQuantiteRecueCfLignes;
