/**
 * FICHIER : modules/gderpi/backend/services/pdf/buildDevisHtmlContext.js
 * RÔLE : Agrège devis, boutique et client pour le rendu HTML.
 *
 * ENTRÉES : db, entrepriseId, devis, req
 * SORTIES : contexte { devis, boutique, client, logoUrl }
 *
 * DÉPEND DE : getBoutiqueById.js, getClientById.js, resolveGderpiStoredMediaUrl.js
 * NE PAS : génération HTML
 *
 * APPELÉ PAR : getDevisHtml.js
 */

const getBoutiqueById = require('../boutiques/getBoutiqueById');
const getClientById = require('../clients/getClientById');
const resolveGderpiStoredMediaUrl = require('./resolveGderpiStoredMediaUrl');

async function buildDevisHtmlContext(db, entrepriseId, devis, req) {
  if (!devis) throw new Error('Devis introuvable');

  const boutique = devis.boutiqueId
    ? await getBoutiqueById(db, entrepriseId, devis.boutiqueId)
    : null;

  let client = null;
  if (devis.clientId) {
    client = await getClientById(db, entrepriseId, devis.clientId);
  }

  const logoUrl = boutique?.logoUrl
    ? resolveGderpiStoredMediaUrl(req, boutique.logoUrl)
    : '';

  return { devis, boutique, client, logoUrl, entrepriseId, req };
}

module.exports = buildDevisHtmlContext;

