/**
 * FICHIER : modules/gderpi/backend/services/besoins/reopenBesoinsFromCommandeFournisseur.js
 * RÔLE : Rouvre les besoins liés à une commande fournisseur annulée (brouillon).
 */

const normalizeBesoin = require('./normalizeBesoin');

function reopenBesoinsFromCommandeFournisseur(besoins, commandeFournisseurId, lignes) {
  const cfId = String(commandeFournisseurId || '').trim();
  if (!cfId) return Array.isArray(besoins) ? besoins : [];

  const articleIds = new Set(
    (Array.isArray(lignes) ? lignes : [])
      .map((l) => (l.articleId ? String(l.articleId).trim() : ''))
      .filter(Boolean)
  );

  return (Array.isArray(besoins) ? besoins : []).map((raw) => {
    const b = normalizeBesoin(raw);
    if (String(b.commandeFournisseurId) !== cfId) return b;
    if (String(b.statut) !== 'commande') return b;
    if (articleIds.size && !articleIds.has(String(b.articleId))) return b;
    return {
      ...b,
      statut: 'ouvert',
      commandeFournisseurId: null
    };
  });
}

module.exports = reopenBesoinsFromCommandeFournisseur;
