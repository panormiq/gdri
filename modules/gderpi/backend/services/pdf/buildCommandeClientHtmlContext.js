/**
 * FICHIER : modules/gderpi/backend/services/pdf/buildCommandeClientHtmlContext.js
 * RÔLE : Agrège commande client, boutique, client et devis source pour le rendu document.
 *
 * ENTRÉES : db, entrepriseId, commande, req
 * SORTIES : contexte { commande, boutique, client, devis, logoUrl, entrepriseId, req }
 *
 * DÉPEND DE : getBoutiqueById.js, getClientById.js, getDevisById.js, resolveGderpiStoredMediaUrl.js
 * NE PAS : génération HTML
 *
 * APPELÉ PAR : getCommandeClientHtml.js
 */

const getBoutiqueById = require('../boutiques/getBoutiqueById');
const getClientById = require('../clients/getClientById');
const getDevisById = require('../devis/getDevisById');
const resolveGderpiStoredMediaUrl = require('./resolveGderpiStoredMediaUrl');

async function buildCommandeClientHtmlContext(db, entrepriseId, commande, req) {
  if (!commande) throw new Error('Commande client introuvable');

  const boutique = commande.boutiqueId
    ? await getBoutiqueById(db, entrepriseId, commande.boutiqueId)
    : null;

  let client = null;
  if (commande.clientId) {
    client = await getClientById(db, entrepriseId, commande.clientId);
  }

  let devis = null;
  if (commande.devisId) {
    devis = await getDevisById(db, entrepriseId, commande.devisId);
  }

  const logoUrl = boutique?.logoUrl
    ? resolveGderpiStoredMediaUrl(req, boutique.logoUrl)
    : '';

  return { commande, boutique, client, devis, logoUrl, entrepriseId, req };
}

module.exports = buildCommandeClientHtmlContext;
