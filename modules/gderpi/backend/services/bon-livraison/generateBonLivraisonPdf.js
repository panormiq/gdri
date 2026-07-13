const getBonLivraisonById = require('./getBonLivraisonById');
const getBonLivraisonHtml = require('./getBonLivraisonHtml');
const htmlToPdfBuffer = require('../pdf/htmlToPdfBuffer');
const buildBonLivraisonPdfFilename = require('../pdf/buildBonLivraisonPdfFilename');

async function generateBonLivraisonPdf(db, entrepriseId, bonLivraisonId, req) {
  const bon = await getBonLivraisonById(db, entrepriseId, bonLivraisonId);
  if (!bon) throw new Error('Bon de livraison introuvable');
  const html = await getBonLivraisonHtml(db, entrepriseId, bonLivraisonId, req);
  const buffer = await htmlToPdfBuffer(html);
  return {
    buffer,
    filename: buildBonLivraisonPdfFilename(bon),
    contentType: 'application/pdf'
  };
}

module.exports = generateBonLivraisonPdf;
