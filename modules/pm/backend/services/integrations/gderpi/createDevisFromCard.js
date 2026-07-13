/**
 * FICHIER : modules/pm/backend/services/integrations/gderpi/createDevisFromCard.js
 * RÔLE : Crée un devis GDERPI depuis une carte PM (Annuaire + pont client).
 */

const path = require('path');
const getCardById = require('../../cards/getCardById');
const syncCardFromDevis = require('./syncCardFromDevis');
const isGderpiAvailable = require('../isGderpiAvailable');
const appendCardActivity = require('../../cards/appendCardActivity');
const ensureGderpiClientForOrganisation = require('../annuaire/ensureGderpiClientForOrganisation');

const SETTINGS = 'pm_settings';

async function getPmSettings(db, entrepriseId) {
  const doc = await db.collection(SETTINGS).findOne({ entrepriseId: String(entrepriseId) });
  return doc || {};
}

async function createDevisFromCard(db, entrepriseId, cardId, options = {}) {
  if (!isGderpiAvailable()) {
    throw new Error('Module GDERPI non installé sur ce serveur');
  }

  const card = await getCardById(db, entrepriseId, cardId);
  if (!card) throw new Error('Carte introuvable');
  if (card.gderpi?.devisId) {
    throw new Error('Un devis GDERPI est déjà lié à cette carte');
  }

  const settings = await getPmSettings(db, entrepriseId);
  const boutiqueId = String(options.boutiqueId || settings.defaultBoutiqueId || '').trim();
  if (!boutiqueId) {
    throw new Error('Boutique GDERPI requise (paramètre boutiqueId ou pm_settings.defaultBoutiqueId)');
  }

  let clientId = null;
  const organisationId = card.annuaire?.organisationId;
  if (organisationId) {
    const org = await ensureGderpiClientForOrganisation(db, entrepriseId, organisationId);
    clientId = org?.gderpiClientId || card.annuaire?.gderpiClientId || null;
    if (org?.gderpiClientId && card.annuaire) {
      await db.collection('pm_cards').updateOne(
        { entrepriseId: String(entrepriseId), cardId: String(cardId).trim() },
        { $set: { 'annuaire.gderpiClientId': org.gderpiClientId, updatedAt: new Date() } }
      );
    }
  }

  const createDevis = require(path.join(
    __dirname,
    '../../../../../gderpi/backend/services/devis/createDevis.js'
  ));

  const devisPayload = {
    boutiqueId,
    pmCardId: cardId,
    objet: card.title,
    notes: [
      card.description,
      card.contactEmail ? `Contact: ${card.contactName || ''} <${card.contactEmail}>` : ''
    ].filter(Boolean).join('\n\n'),
    contactNom: card.contactName || '',
    contactEmail: card.contactEmail || ''
  };
  if (clientId) devisPayload.clientId = clientId;

  const devis = await createDevis(db, entrepriseId, devisPayload);

  const updated = await syncCardFromDevis(db, entrepriseId, { ...devis, pmCardId: cardId }, { cardId });
  await appendCardActivity(db, entrepriseId, cardId, {
    type: 'gderpi_create',
    message: `Devis GDERPI ${devis.numero || devis.devisId} créé` +
      (clientId ? ' (client Annuaire lié)' : '')
  });
  return { card: updated, devis };
}

module.exports = createDevisFromCard;
