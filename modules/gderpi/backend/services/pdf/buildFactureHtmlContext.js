/**
 * FICHIER : modules/gderpi/backend/services/pdf/buildFactureHtmlContext.js
 * RÔLE : Agrège commande client, boutique, client et devis source pour le rendu facture.
 */

const getBoutiqueById = require('../boutiques/getBoutiqueById');
const getClientById = require('../clients/getClientById');
const getDevisById = require('../devis/getDevisById');
const resolveGderpiStoredMediaUrl = require('./resolveGderpiStoredMediaUrl');

async function buildFactureHtmlContext(db, entrepriseId, commande, req) {
  if (!commande) throw new Error('Commande client introuvable');
  if (!commande.factureNumero) {
    throw new Error('La facture doit être émise avant génération du document');
  }

  const boutique = commande.boutiqueId
    ? await getBoutiqueById(db, entrepriseId, commande.boutiqueId)
    : null;

  let client = null;
  if (commande.clientId) {
    client = await getClientById(db, entrepriseId, commande.clientId);
  }

  let devis = null;
  if (commande.devisId) {
    devis = await getDevisById(db, entrepriseId, commande.devisId);
  }

  const logoUrl = boutique?.logoUrl
    ? resolveGderpiStoredMediaUrl(req, boutique.logoUrl)
    : '';

  return { commande, boutique, client, devis, logoUrl, entrepriseId, req };
}

module.exports = buildFactureHtmlContext;
