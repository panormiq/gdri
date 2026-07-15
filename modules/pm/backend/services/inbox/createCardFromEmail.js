/**
 * FICHIER : modules/pm/backend/services/inbox/createCardFromEmail.js
 * RÔLE : Crée une carte PM à partir d'un e-mail entrant + lien Annuaire.
 */

const createCard = require('../cards/createCard');
const detectEmailIntent = require('./detectEmailIntent');
const resolveContactFromEmail = require('../integrations/annuaire/resolveContactFromEmail');
const appendCardActivity = require('../cards/appendCardActivity');

async function createCardFromEmail(db, entrepriseId, email) {
  const intent = detectEmailIntent({
    subject: email.subject,
    body: email.bodyText || email.snippet
  });

  const annuaireHit = await resolveContactFromEmail(db, entrepriseId, email, {
    ownerUserId: email.ownerUserId || null
  });

  const contactName = annuaireHit?.contactName
    || String(email.fromName || '').trim();
  const contactEmail = annuaireHit?.contactEmail
    || String(email.fromEmail || '').trim();

  const card = await createCard(db, entrepriseId, {
    title: String(email.subject || 'Demande entrante').trim(),
    description: String(email.snippet || '').trim(),
    type: intent.type,
    columnId: intent.columnId,
    contactName,
    contactEmail,
    annuaire: annuaireHit ? {
      contactId: annuaireHit.contactId,
      organisationId: annuaireHit.organisationId,
      contactName: annuaireHit.contactName,
      contactEmail: annuaireHit.contactEmail,
      organisationName: annuaireHit.organisationName,
      gderpiClientId: annuaireHit.gderpiClientId
    } : null,
    tasks: intent.suggestedTasks,
    sourceEmail: {
      messageId: String(email.messageId),
      uid: email.uid || null,
      from: email.fromEmail,
      fromName: email.fromName || '',
      subject: email.subject || '',
      receivedAt: email.receivedAt || new Date(),
      snippet: email.snippet || ''
    }
  });

  if (annuaireHit) {
    const msg = annuaireHit.created
      ? `Contact Annuaire créé : ${annuaireHit.contactName}`
      : `Contact Annuaire identifié : ${annuaireHit.contactName}`;
    await appendCardActivity(db, entrepriseId, card.cardId, {
      type: 'annuaire',
      message: msg
    });
    return getCardRefreshed(db, entrepriseId, card.cardId);
  }

  return card;
}

async function getCardRefreshed(db, entrepriseId, cardId) {
  const getCardById = require('../cards/getCardById');
  return getCardById(db, entrepriseId, cardId);
}

module.exports = createCardFromEmail;
