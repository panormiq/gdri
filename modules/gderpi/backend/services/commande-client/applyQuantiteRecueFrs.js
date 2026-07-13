/**
 * FICHIER : modules/gderpi/backend/services/commande-client/applyQuantiteRecueFrs.js
 * RÔLE : Incrémente quantiteRecueFrs sur les lignes commande depuis une réception CF.
 *
 * ENTRÉES : lignes commande, lignes CF
 * SORTIES : lignes mises à jour (copie)
 *
 * DÉPEND DE : remainingLineQty.js
 * NE PAS : persistance Mongo
 *
 * APPELÉ PAR : creditQuantiteRecueFrsFromCf.js
 */

const remainingLineQty = require('../workflow/remainingLineQty');

function roundQty(value) {
  return Math.round(Number(value) * 10000) / 10000;
}

function isProductLine(line) {
  const t = String(line?.articleType || '').toLowerCase();
  return t === 'produit' || (t !== 'developpement' && t !== 'service' && Boolean(line?.articleId));
}

function matchLineIndex(list, cfLine) {
  const lineId = String(cfLine.id || cfLine.lineId || '').trim();
  const articleId = cfLine.articleId != null ? String(cfLine.articleId).trim() : '';
  const ref = String(cfLine.reference || '').trim();
  const libelle = String(cfLine.libelle || '').trim();

  if (lineId) {
    const idx = list.findIndex((l) => String(l.id) === lineId);
    if (idx >= 0) return idx;
  }

  if (articleId) {
    const idx = list.findIndex((l) => isProductLine(l) && String(l.articleId || '').trim() === articleId);
    if (idx >= 0) return idx;
  }

  if (ref && libelle) {
    return list.findIndex((l) => l.reference === ref && l.libelle === libelle);
  }

  return -1;
}

function distributeQtyToArticleLines(list, articleId, qty) {
  const indices = list
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => isProductLine(l) && String(l.articleId || '').trim() === String(articleId).trim())
    .map(({ i }) => i);

  if (!indices.length) return;

  let remaining = qty;
  const weights = indices.map((idx) => remainingLineQty(list[idx]));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  indices.forEach((idx, pos) => {
    let share;
    if (pos === indices.length - 1) {
      share = remaining;
    } else if (totalWeight > 0) {
      share = roundQty(qty * (weights[pos] / totalWeight));
      remaining = roundQty(remaining - share);
    } else {
      share = roundQty(qty / indices.length);
      remaining = roundQty(remaining - share);
    }

    const current = Number(list[idx].quantiteRecueFrs) || 0;
    list[idx].quantiteRecueFrs = roundQty(current + share);
  });
}

function applyQuantiteRecueFrs(lignes, cfLignes) {
  const list = Array.isArray(lignes) ? lignes.map((l) => ({ ...l })) : [];
  const receptions = Array.isArray(cfLignes) ? cfLignes : [];

  receptions.forEach((cfLine) => {
    const qty = Number(cfLine.quantite) || 0;
    if (qty <= 0) return;

    const articleId = cfLine.articleId != null ? String(cfLine.articleId).trim() : '';
    if (articleId) {
      distributeQtyToArticleLines(list, articleId, qty);
      return;
    }

    const idx = matchLineIndex(list, cfLine);
    if (idx < 0) return;

    const current = Number(list[idx].quantiteRecueFrs) || 0;
    list[idx].quantiteRecueFrs = roundQty(current + qty);
  });

  return list;
}

module.exports = applyQuantiteRecueFrs;
