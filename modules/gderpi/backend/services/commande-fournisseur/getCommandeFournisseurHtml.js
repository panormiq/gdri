/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/getCommandeFournisseurHtml.js
 * RÔLE : Produit le HTML d'aperçu pour une commande fournisseur enregistrée.
 *
 * ENTRÉES : db, entrepriseId, commandeFournisseurId, req
 * SORTIES : string HTML
 *
 * DÉPEND DE : getCommandeFournisseurById.js, buildCommandeFournisseurHtmlContext.js, renderCommandeFournisseurHtml.js
 * NE PAS : génération PDF
 *
 * APPELÉ PAR : workflowController
 */

const getCommandeFournisseurById = require('./getCommandeFournisseurById');
const buildCommandeFournisseurHtmlContext = require('../pdf/buildCommandeFournisseurHtmlContext');
const renderCommandeFournisseurHtml = require('../pdf/renderCommandeFournisseurHtml');

async function getCommandeFournisseurHtml(db, entrepriseId, commandeFournisseurId, req) {
  const commande = await getCommandeFournisseurById(db, entrepriseId, commandeFournisseurId);
  if (!commande) throw new Error('Commande fournisseur introuvable');
  const context = await buildCommandeFournisseurHtmlContext(db, entrepriseId, commande, req);
  return renderCommandeFournisseurHtml(context);
}

module.exports = getCommandeFournisseurHtml;
