const getBoutiqueById = require('../boutiques/getBoutiqueById');
const getClientById = require('../clients/getClientById');
const getDevisById = require('../devis/getDevisById');
const resolveGderpiStoredMediaUrl = require('./resolveGderpiStoredMediaUrl');

async function buildBonLivraisonHtmlContext(db, entrepriseId, bon, req) {
  if (!bon) throw new Error('Bon de livraison introuvable');

  const boutique = bon.boutiqueId
    ? await getBoutiqueById(db, entrepriseId, bon.boutiqueId)
    : null;

  let client = null;
  if (bon.clientId) {
    client = await getClientById(db, entrepriseId, bon.clientId);
  }

  let devis = null;
  if (bon.devisId) {
    devis = await getDevisById(db, entrepriseId, bon.devisId);
  }

  const logoUrl = boutique?.logoUrl
    ? resolveGderpiStoredMediaUrl(req, boutique.logoUrl)
    : '';

  return { bon, boutique, client, devis, logoUrl, entrepriseId, req };
}

module.exports = buildBonLivraisonHtmlContext;
