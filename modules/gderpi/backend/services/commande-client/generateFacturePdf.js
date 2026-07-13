/**

 * FICHIER : modules/gderpi/backend/services/commande-client/generateFacturePdf.js

 */



const getCommandeClientById = require('./getCommandeClientById');

const getFactureHtml = require('./getFactureHtml');

const htmlToPdfBuffer = require('../pdf/htmlToPdfBuffer');

const buildFacturePdfFilename = require('../pdf/buildFacturePdfFilename');

const isEconomyRenderMode = require('../pdf/isEconomyRenderMode');

const { resolveFactureForSend } = require('../facturation/resolveFactureById');

const buildCommandeForFactureRender = require('../facturation/buildCommandeForFactureRender');



async function generateFacturePdf(db, entrepriseId, commandeClientId, req, options = {}) {

  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId);

  if (!commande) throw new Error('Commande client introuvable');



  const factureId = options.factureId != null ? String(options.factureId).trim() : '';

  const facture = await resolveFactureForSend(db, entrepriseId, commandeClientId, commande, factureId);

  if (!facture) throw new Error('Facture introuvable');



  const economy = isEconomyRenderMode(options.economy != null ? options : req);

  const html = await getFactureHtml(db, entrepriseId, commandeClientId, req, { economy, factureId: facture.id });

  const buffer = await htmlToPdfBuffer(html, { printBackground: !economy });

  const renderCommande = buildCommandeForFactureRender(commande, facture);

  return {

    buffer,

    filename: buildFacturePdfFilename(renderCommande),

    contentType: 'application/pdf'

  };

}



module.exports = generateFacturePdf;

