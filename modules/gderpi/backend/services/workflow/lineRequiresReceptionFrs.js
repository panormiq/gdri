/**
 * FICHIER : modules/gderpi/backend/services/workflow/lineRequiresReceptionFrs.js
 * RÔLE : Indique si une ligne produit dépend d'une réception fournisseur (besoin d'achat stock).
 *
 * ENTRÉES : ligne commande, commande client
 * SORTIES : boolean
 *
 * DÉPEND DE : —
 * NE PAS : persistance, calcul quantités
 *
 * APPELÉ PAR : resolveQuantiteLivrable.js
 */

function isProductLine(line) {
  const t = String(line?.articleType || '').toLowerCase();
  return t === 'produit' || (t !== 'developpement' && t !== 'service' && Boolean(line?.articleId));
}

function lineRequiresReceptionFrs(line, commande) {
  if (!isProductLine(line)) return false;

  const articleId = line?.articleId ? String(line.articleId).trim() : '';
  if (!articleId) return false;

  const besoins = Array.isArray(commande?.besoins) ? commande.besoins : [];
  return besoins.some((b) => {
    if (String(b.statut) === 'annule') return false;
    return String(b.articleId || '').trim() === articleId;
  });
}

module.exports = lineRequiresReceptionFrs;
