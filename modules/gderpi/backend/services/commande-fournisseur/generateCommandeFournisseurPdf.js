/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/generateCommandeFournisseurPdf.js
 * RÔLE : Produit le PDF d'une commande fournisseur enregistrée.
 *
 * ENTRÉES : db, entrepriseId, commandeFournisseurId, req
 * SORTIES : { buffer, filename, contentType }
 *
 * DÉPEND DE : getCommandeFournisseurHtml.js, htmlToPdfBuffer.js, buildCommandeFournisseurPdfFilename.js
 * NE PAS : réponse HTTP
 *
 * APPELÉ PAR : workflowController
 */

const getCommandeFournisseurById = require('./getCommandeFournisseurById');
const getCommandeFournisseurHtml = require('./getCommandeFournisseurHtml');
const htmlToPdfBuffer = require('../pdf/htmlToPdfBuffer');
const buildCommandeFournisseurPdfFilename = require('../pdf/buildCommandeFournisseurPdfFilename');

async function generateCommandeFournisseurPdf(db, entrepriseId, commandeFournisseurId, req) {
  const commande = await getCommandeFournisseurById(db, entrepriseId, commandeFournisseurId);
  if (!commande) throw new Error('Commande fournisseur introuvable');

  const html = await getCommandeFournisseurHtml(db, entrepriseId, commandeFournisseurId, req);
  const buffer = await htmlToPdfBuffer(html);
  return {
    buffer,
    filename: buildCommandeFournisseurPdfFilename(commande),
    contentType: 'application/pdf'
  };
}

module.exports = generateCommandeFournisseurPdf;
