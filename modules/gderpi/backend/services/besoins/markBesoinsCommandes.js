/**
 * FICHIER : modules/gderpi/backend/services/besoins/markBesoinsCommandes.js
 * RÔLE : Marque les besoins comme commandés et les lie à une commande fournisseur.
 */

const normalizeBesoin = require('./normalizeBesoin');

function markBesoinsCommandes(besoins, besoinIds, commandeFournisseurId) {
  const ids = new Set((Array.isArray(besoinIds) ? besoinIds : []).map(String));
  const cmdFrsId = String(commandeFournisseurId || '').trim();
  if (!ids.size || !cmdFrsId) return Array.isArray(besoins) ? besoins : [];

  return (Array.isArray(besoins) ? besoins : []).map((raw) => {
    const b = normalizeBesoin(raw);
    if (!ids.has(String(b.besoinId))) return b;
    return {
      ...b,
      statut: 'commande',
      commandeFournisseurId: cmdFrsId
    };
  });
}

module.exports = markBesoinsCommandes;
