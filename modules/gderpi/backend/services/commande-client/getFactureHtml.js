/**

 * FICHIER : modules/gderpi/backend/services/commande-client/getFactureHtml.js

 */



const getCommandeClientById = require('./getCommandeClientById');

const buildFactureHtmlContext = require('../pdf/buildFactureHtmlContext');

const renderFactureHtml = require('../pdf/renderFactureHtml');

const { resolveFactureForSend } = require('../facturation/resolveFactureById');

const buildCommandeForFactureRender = require('../facturation/buildCommandeForFactureRender');

const isEconomyRenderMode = require('../pdf/isEconomyRenderMode');



async function getFactureHtml(db, entrepriseId, commandeClientId, req, options = {}) {

  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId);

  if (!commande) throw new Error('Commande client introuvable');



  const factureId = options.factureId != null ? String(options.factureId).trim() : '';

  const facture = await resolveFactureForSend(db, entrepriseId, commandeClientId, commande, factureId);

  if (!facture) throw new Error('Facture introuvable');



  const renderCommande = buildCommandeForFactureRender(commande, facture);

  const context = await buildFactureHtmlContext(db, entrepriseId, renderCommande, req);

  context.economy = isEconomyRenderMode(options.economy != null ? options : req);

  return renderFactureHtml(context);

}



module.exports = getFactureHtml;

