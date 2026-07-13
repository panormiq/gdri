/**
 * FICHIER : modules/gderpi/backend/services/workflow/commandeNeedsAchats.js
 * RÔLE : Indique si la commande nécessite un flux achats fournisseur.
 */

const { commandeClientKind } = require('./commandeClientKind');

function commandeNeedsAchats(commande) {
  const kind = commandeClientKind(commande);
  if (kind === 'dev') return false;

  const besoins = Array.isArray(commande?.besoins) ? commande.besoins : [];
  if (besoins.some((b) => ['ouvert', 'commande'].includes(String(b.statut)))) return true;

  const lignes = Array.isArray(commande?.lignes) ? commande.lignes : [];
  return lignes.some((l) => {
    const t = String(l.articleType || '').toLowerCase();
    return t === 'produit' || (t !== 'developpement' && t !== 'service' && l.articleId);
  });
}

module.exports = commandeNeedsAchats;
