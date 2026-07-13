/**
 * FICHIER : modules/gderpi/backend/services/commande-client/generateCommandeClientPdf.js
 * RÔLE : Produit le PDF d'une commande client enregistrée.
 *
 * ENTRÉES : db, entrepriseId, commandeClientId, req
 * SORTIES : { buffer, filename, contentType }
 *
 * DÉPEND DE : getCommandeClientHtml.js, htmlToPdfBuffer.js, buildCommandeClientPdfFilename.js
 * NE PAS : réponse HTTP
 *
 * APPELÉ PAR : workflowController
 */

const getCommandeClientById = require('./getCommandeClientById');
const getCommandeClientHtml = require('./getCommandeClientHtml');
const htmlToPdfBuffer = require('../pdf/htmlToPdfBuffer');
const buildCommandeClientPdfFilename = require('../pdf/buildCommandeClientPdfFilename');
const isEconomyRenderMode = require('../pdf/isEconomyRenderMode');

async function generateCommandeClientPdf(db, entrepriseId, commandeClientId, req, options = {}) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId);
  if (!commande) throw new Error('Commande client introuvable');

  const economy = isEconomyRenderMode(options.economy != null ? options : req);
  const html = await getCommandeClientHtml(db, entrepriseId, commandeClientId, req, { economy });
  const buffer = await htmlToPdfBuffer(html, { printBackground: !economy });
  return {
    buffer,
    filename: buildCommandeClientPdfFilename(commande),
    contentType: 'application/pdf'
  };
}

module.exports = generateCommandeClientPdf;
