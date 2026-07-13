/**
 * FICHIER : modules/gderpi/backend/services/besoins/besoinIdsForLignes.js
 * RÔLE : Retrouve les besoinId correspondant aux lignes fournisseur (par articleId).
 */

function besoinIdsForLignes(besoins, lignes) {
  const open = (Array.isArray(besoins) ? besoins : []).filter((b) => String(b.statut) === 'ouvert');
  const articleIds = new Set(
    (Array.isArray(lignes) ? lignes : [])
      .map((l) => (l.articleId ? String(l.articleId).trim() : ''))
      .filter(Boolean)
  );
  return open
    .filter((b) => articleIds.has(String(b.articleId)))
    .map((b) => b.besoinId);
}

module.exports = besoinIdsForLignes;
