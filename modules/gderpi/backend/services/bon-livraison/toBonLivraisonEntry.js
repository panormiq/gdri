const normalizeBonLivraison = require('./normalizeBonLivraison');

function isoDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function toBonLivraisonEntry(doc) {
  if (!doc) return null;
  const n = normalizeBonLivraison(doc);
  return {
    ...n,
    bonLivraisonId: n.id,
    createdAt: isoDate(doc.createdAt) || n.createdAt,
    updatedAt: isoDate(doc.updatedAt) || n.updatedAt,
    dateLivraison: isoDate(doc.dateLivraison) || n.dateLivraison
  };
}

module.exports = toBonLivraisonEntry;
