/**
 * FICHIER : modules/gderpi/backend/services/devis/generateDevisPdf.js
 * RÔLE : Produit le PDF d'un devis enregistré.
 *
 * ENTRÉES : db, entrepriseId, devisId, req
 * SORTIES : { buffer, filename, contentType }
 *
 * DÉPEND DE : getDevisHtml.js, htmlToPdfBuffer.js, buildDevisPdfFilename.js
 * NE PAS : réponse HTTP
 *
 * APPELÉ PAR : devisController.downloadPdf
 */

const getDevisHtml = require('./getDevisHtml');
const getDevisById = require('./getDevisById');
const htmlToPdfBuffer = require('../pdf/htmlToPdfBuffer');
const buildDevisPdfFilename = require('../pdf/buildDevisPdfFilename');
const isEconomyRenderMode = require('../pdf/isEconomyRenderMode');

async function generateDevisPdf(db, entrepriseId, devisId, req, options = {}) {
  const devis = await getDevisById(db, entrepriseId, devisId);
  if (!devis) throw new Error('Devis introuvable');

  const economy = isEconomyRenderMode(options.economy != null ? options : req);
  const html = await getDevisHtml(db, entrepriseId, devisId, req, { economy });
  const buffer = await htmlToPdfBuffer(html, { printBackground: !economy });
  return {
    buffer,
    filename: buildDevisPdfFilename(devis),
    contentType: 'application/pdf'
  };
}

module.exports = generateDevisPdf;
