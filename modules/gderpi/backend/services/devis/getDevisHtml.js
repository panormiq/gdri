/**

 * FICHIER : modules/gderpi/backend/services/devis/getDevisHtml.js

 * RÔLE : Produit le HTML d'aperçu pour un devis enregistré.

 *

 * ENTRÉES : db, entrepriseId, devisId, req

 * SORTIES : string HTML

 *

 * DÉPEND DE : getDevisById.js, buildDevisHtmlContext.js, renderDevisHtml.js

 * NE PAS : génération PDF

 *

 * APPELÉ PAR : devisController

 */



const getDevisById = require('./getDevisById');

const buildDevisHtmlContext = require('../pdf/buildDevisHtmlContext');

const renderDevisHtml = require('../pdf/renderDevisHtml');



const isEconomyRenderMode = require('../pdf/isEconomyRenderMode');

async function getDevisHtml(db, entrepriseId, devisId, req, options = {}) {
  const devis = await getDevisById(db, entrepriseId, devisId);
  if (!devis) throw new Error('Devis introuvable');
  const context = await buildDevisHtmlContext(db, entrepriseId, devis, req);
  context.economy = isEconomyRenderMode(options.economy != null ? options : req);
  return renderDevisHtml(context);
}



module.exports = getDevisHtml;


