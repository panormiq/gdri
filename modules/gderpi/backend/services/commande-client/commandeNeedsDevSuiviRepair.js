/**
 * FICHIER : modules/gderpi/backend/services/commande-client/commandeNeedsDevSuiviRepair.js
 * RÔLE : Détecte une commande existante dont les lignes dev n'ont pas encore le suivi à jour.
 *
 * ENTRÉES : document Mongo commande client
 * SORTIES : boolean
 *
 * DÉPEND DE : —
 * NE PAS : persistance, lookup catalogue
 *
 * APPELÉ PAR : listCommandesClient.js, getCommandeClientById.js
 */

function commandeNeedsDevSuiviRepair(doc) {
  if (!doc) return false;
  const statut = String(doc.statut || '');
  if (statut === 'facturee' || statut === 'annulee') return false;

  const lines = Array.isArray(doc.lignes) ? doc.lignes : [];
  const lineNeedsRepair = lines.some((line) => {
    if (!line) return false;
    if (line.gererCommande === true) return false;
    const type = String(line.articleType || '').trim().toLowerCase();
    if (type === 'developpement' && !line.recetteValideeAt) return true;
    if (!type && line.articleId) return true;
    return false;
  });
  if (lineNeedsRepair) return true;

  const hasProdLine = lines.some((l) => String(l.articleType || '').toLowerCase() === 'produit');
  const besoins = Array.isArray(doc.besoins) ? doc.besoins : [];
  if (!hasProdLine && besoins.some((b) => String(b.statut) === 'ouvert')) return true;
  return false;
}

module.exports = commandeNeedsDevSuiviRepair;
