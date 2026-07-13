/**
 * FICHIER : modules/gderpi/backend/services/commande-client/getAvoirHtml.js
 */

const getCommandeClientById = require('./getCommandeClientById');
const buildAvoirHtmlContext = require('../pdf/buildAvoirHtmlContext');
const renderAvoirHtml = require('../pdf/renderAvoirHtml');
const resolveFactureById = require('../facturation/resolveFactureById');
const resolveAvoirById = require('../facturation/resolveAvoirById');
const buildCommandeForAvoirRender = require('../facturation/buildCommandeForAvoirRender');
const isEconomyRenderMode = require('../pdf/isEconomyRenderMode');

async function getAvoirHtml(db, entrepriseId, commandeClientId, req, options = {}) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId);
  if (!commande) throw new Error('Commande client introuvable');

  const factureId = options.factureId != null ? String(options.factureId).trim() : '';
  const avoirId = options.avoirId != null ? String(options.avoirId).trim() : '';
  if (!factureId || !avoirId) throw new Error('Avoir introuvable');

  const facture = resolveFactureById(commande, factureId);
  if (!facture) throw new Error('Facture introuvable');

  const avoir = resolveAvoirById(facture, avoirId);
  if (!avoir) throw new Error('Avoir introuvable');

  const renderCommande = buildCommandeForAvoirRender(commande, facture, avoir);
  const context = await buildAvoirHtmlContext(db, entrepriseId, renderCommande, req);
  context.economy = isEconomyRenderMode(options.economy != null ? options : req);
  return renderAvoirHtml(context);
}

module.exports = getAvoirHtml;
