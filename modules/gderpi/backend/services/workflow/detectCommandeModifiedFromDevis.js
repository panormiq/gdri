/**
 * FICHIER : modules/gderpi/backend/services/workflow/detectCommandeModifiedFromDevis.js
 * RÔLE : Détecte si les lignes commande diffèrent du devis source.
 */

function normQty(v) {
  return Math.round((Number(v) || 0) * 10000) / 10000;
}

function normStr(v) {
  return String(v || '').trim().toLowerCase();
}

function detectCommandeModifiedFromDevis(devisLignes, commandeLignes) {
  const src = Array.isArray(devisLignes) ? devisLignes : [];
  const dst = Array.isArray(commandeLignes) ? commandeLignes : [];
  if (src.length !== dst.length) return true;

  for (let i = 0; i < src.length; i += 1) {
    const a = src[i] || {};
    const b = dst[i] || {};
    if (normStr(a.libelle) !== normStr(b.libelle)) return true;
    if (normStr(a.reference) !== normStr(b.reference)) return true;
    if (normQty(a.quantite) !== normQty(b.quantite)) return true;
    if (normStr(a.articleId) !== normStr(b.articleId)) return true;
    if (normQty(a.prixHt) !== normQty(b.prixHt)) return true;
    if (normQty(a.remisePct) !== normQty(b.remisePct)) return true;
  }
  return false;
}

module.exports = detectCommandeModifiedFromDevis;
