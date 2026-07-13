const getBonLivraisonById = require('../bon-livraison/getBonLivraisonById');
const buildBonLivraisonHtmlContext = require('../pdf/buildBonLivraisonHtmlContext');
const renderBonLivraisonHtml = require('../pdf/renderBonLivraisonHtml');

async function getBonLivraisonHtml(db, entrepriseId, bonLivraisonId, req) {
  const bon = await getBonLivraisonById(db, entrepriseId, bonLivraisonId);
  if (!bon) throw new Error('Bon de livraison introuvable');
  const context = await buildBonLivraisonHtmlContext(db, entrepriseId, bon, req);
  return renderBonLivraisonHtml(context);
}

module.exports = getBonLivraisonHtml;
