/**
 * FICHIER : modules/gderpi/backend/services/articles/buildArticleFournisseursFromLegacy.js
 * RÔLE : Construit fournisseursArticle[] à partir des champs legacy fournisseurId / referenceFournisseur.
 *
 * ENTRÉES : raw article (legacy)
 * SORTIES : fournisseur[] (non normalisé)
 *
 * DÉPEND DE : —
 * NE PAS : persistance
 *
 * APPELÉ PAR : normalizeArticleFournisseurs.js
 */

function buildArticleFournisseursFromLegacy(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const fournisseurId = a.fournisseurId != null ? String(a.fournisseurId).trim() : '';
  if (!fournisseurId) return [];
  return [{
    sourceType: 'fournisseur',
    fournisseurId,
    boutiqueId: '',
    principal: true,
    referenceFournisseur: String(a.referenceFournisseur || '').trim(),
    prixAchatHt: null,
    moq: null,
    delaiJours: null,
    conditions: '',
    actif: true
  }];
}

module.exports = buildArticleFournisseursFromLegacy;
