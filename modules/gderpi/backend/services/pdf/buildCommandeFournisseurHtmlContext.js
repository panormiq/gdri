/**
 * FICHIER : modules/gderpi/backend/services/pdf/buildCommandeFournisseurHtmlContext.js
 * RÔLE : Agrège commande fournisseur, boutique, fournisseur et commande client source.
 *
 * ENTRÉES : db, entrepriseId, commande, req
 * SORTIES : contexte { commande, boutique, fournisseur, commandeClient, logoUrl, entrepriseId, req }
 *
 * DÉPEND DE : getBoutiqueById.js, getFournisseurById.js, getCommandeClientById.js, resolveGderpiStoredMediaUrl.js
 * NE PAS : génération HTML
 *
 * APPELÉ PAR : getCommandeFournisseurHtml.js
 */

const getBoutiqueById = require('../boutiques/getBoutiqueById');
const getFournisseurById = require('../fournisseurs/getFournisseurById');
const getCommandeClientById = require('../commande-client/getCommandeClientById');
const resolveGderpiStoredMediaUrl = require('./resolveGderpiStoredMediaUrl');
const mapBoutiqueAsFournisseurDisplay = require('./mapBoutiqueAsFournisseurDisplay');

async function buildCommandeFournisseurHtmlContext(db, entrepriseId, commande, req) {
  if (!commande) throw new Error('Commande fournisseur introuvable');

  const boutique = commande.boutiqueId
    ? await getBoutiqueById(db, entrepriseId, commande.boutiqueId)
    : null;

  let fournisseur = null;
  if (commande.fournisseurBoutiqueId) {
    const btq = await getBoutiqueById(db, entrepriseId, commande.fournisseurBoutiqueId);
    fournisseur = mapBoutiqueAsFournisseurDisplay(btq);
  } else if (commande.fournisseurId) {
    fournisseur = await getFournisseurById(db, entrepriseId, commande.fournisseurId);
  }

  let commandeClient = null;
  if (commande.commandeClientId) {
    commandeClient = await getCommandeClientById(db, entrepriseId, commande.commandeClientId);
  }

  const logoUrl = boutique?.logoUrl
    ? resolveGderpiStoredMediaUrl(req, boutique.logoUrl)
    : '';

  return { commande, boutique, fournisseur, commandeClient, logoUrl, entrepriseId, req };
}

module.exports = buildCommandeFournisseurHtmlContext;
