/**
 * FICHIER : modules/gderpi/backend/services/commande-client/getCommandeClientHtml.js
 * RÔLE : Produit le HTML d'aperçu pour une commande client enregistrée.
 *
 * ENTRÉES : db, entrepriseId, commandeClientId, req
 * SORTIES : string HTML
 *
 * DÉPEND DE : getCommandeClientById.js, buildCommandeClientHtmlContext.js, renderCommandeClientHtml.js
 * NE PAS : génération PDF
 *
 * APPELÉ PAR : workflowController
 */

const getCommandeClientById = require('./getCommandeClientById');
const buildCommandeClientHtmlContext = require('../pdf/buildCommandeClientHtmlContext');
const renderCommandeClientHtml = require('../pdf/renderCommandeClientHtml');

const isEconomyRenderMode = require('../pdf/isEconomyRenderMode');

async function getCommandeClientHtml(db, entrepriseId, commandeClientId, req, options = {}) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId);
  if (!commande) throw new Error('Commande client introuvable');
  const context = await buildCommandeClientHtmlContext(db, entrepriseId, commande, req);
  context.economy = isEconomyRenderMode(options.economy != null ? options : req);
  return renderCommandeClientHtml(context);
}

module.exports = getCommandeClientHtml;
