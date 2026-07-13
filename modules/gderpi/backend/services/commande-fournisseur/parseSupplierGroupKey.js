/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/parseSupplierGroupKey.js
 * RÔLE : Décode une clé de regroupement fournisseur (externe ou boutique).
 *
 * ENTRÉES : groupKey string
 * SORTIES : { fournisseurId, fournisseurBoutiqueId }
 *
 * DÉPEND DE : —
 * NE PAS : persistance
 *
 * APPELÉ PAR : createFromCommandeClient.js
 */

function parseSupplierGroupKey(groupKey) {
  const key = String(groupKey || '').trim();
  if (!key || key === '__sans_fournisseur__') {
    return { fournisseurId: null, fournisseurBoutiqueId: null };
  }
  if (key.startsWith('btq:')) {
    return { fournisseurId: null, fournisseurBoutiqueId: key.slice(4) || null };
  }
  if (key.startsWith('frs:')) {
    return { fournisseurId: key.slice(4) || null, fournisseurBoutiqueId: null };
  }
  return { fournisseurId: key, fournisseurBoutiqueId: null };
}

module.exports = parseSupplierGroupKey;
