/**
 * FICHIER : modules/gderpi/backend/services/commande-client/generateAvoirPdf.js
 */

const getCommandeClientById = require('./getCommandeClientById');
const getAvoirHtml = require('./getAvoirHtml');
const htmlToPdfBuffer = require('../pdf/htmlToPdfBuffer');
const buildAvoirPdfFilename = require('../pdf/buildAvoirPdfFilename');
const isEconomyRenderMode = require('../pdf/isEconomyRenderMode');
const resolveFactureById = require('../facturation/resolveFactureById');
const resolveAvoirById = require('../facturation/resolveAvoirById');
const buildCommandeForAvoirRender = require('../facturation/buildCommandeForAvoirRender');

async function generateAvoirPdf(db, entrepriseId, commandeClientId, req, options = {}) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId);
  if (!commande) throw new Error('Commande client introuvable');

  const factureId = options.factureId != null ? String(options.factureId).trim() : '';
  const avoirId = options.avoirId != null ? String(options.avoirId).trim() : '';
  if (!factureId || !avoirId) throw new Error('Avoir introuvable');

  const facture = resolveFactureById(commande, factureId);
  if (!facture) throw new Error('Facture introuvable');

  const avoir = resolveAvoirById(facture, avoirId);
  if (!avoir) throw new Error('Avoir introuvable');

  const economy = isEconomyRenderMode(options.economy != null ? options : req);
  const html = await getAvoirHtml(db, entrepriseId, commandeClientId, req, {
    economy,
    factureId,
    avoirId
  });
  const buffer = await htmlToPdfBuffer(html, { printBackground: !economy });
  const renderCommande = buildCommandeForAvoirRender(commande, facture, avoir);

  return {
    buffer,
    filename: buildAvoirPdfFilename(renderCommande),
    contentType: 'application/pdf'
  };
}

module.exports = generateAvoirPdf;
