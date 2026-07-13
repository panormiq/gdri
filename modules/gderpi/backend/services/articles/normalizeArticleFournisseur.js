/**
 * FICHIER : modules/gderpi/backend/services/articles/normalizeArticleFournisseur.js
 * RÔLE : Normalise une entrée fournisseur rattachée à un article (externe ou boutique).
 *
 * ENTRÉES : raw { sourceType, fournisseurId, boutiqueId, principal, ... }
 * SORTIES : objet normalisé
 *
 * DÉPEND DE : —
 * NE PAS : persistance, liste complète
 *
 * APPELÉ PAR : normalizeArticleFournisseurs.js
 */

function normalizeArticleFournisseur(raw) {
  const f = raw && typeof raw === 'object' ? raw : {};
  const prixAchatHt = Number(f.prixAchatHt);
  const moq = Number(f.moq);
  const delaiJours = Number(f.delaiJours);
  const fournisseurId = String(f.fournisseurId || '').trim();
  const boutiqueId = String(f.boutiqueId || '').trim();
  const sourceTypeRaw = String(f.sourceType || '').trim().toLowerCase();

  let sourceType = 'fournisseur';
  if (sourceTypeRaw === 'boutique' || (!fournisseurId && boutiqueId)) {
    sourceType = 'boutique';
  } else if (fournisseurId) {
    sourceType = 'fournisseur';
  }

  return {
    sourceType,
    fournisseurId: sourceType === 'fournisseur' ? fournisseurId : '',
    boutiqueId: sourceType === 'boutique' ? boutiqueId : '',
    principal: f.principal === true,
    referenceFournisseur: String(f.referenceFournisseur || '').trim(),
    prixAchatHt: Number.isFinite(prixAchatHt) && prixAchatHt >= 0 ? Math.round(prixAchatHt * 100) / 100 : null,
    moq: Number.isFinite(moq) && moq > 0 ? Math.round(moq * 1000) / 1000 : null,
    delaiJours: Number.isFinite(delaiJours) && delaiJours >= 0 ? Math.round(delaiJours) : null,
    conditions: String(f.conditions || '').trim(),
    actif: f.actif !== false
  };
}

module.exports = normalizeArticleFournisseur;
