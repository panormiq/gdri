/**
 * FICHIER : modules/annuaire/backend/services/contacts/createContactFromEmail.js
 */

const findContactByEmail = require('./findContactByEmail');
const createOrganisation = require('../organisations/createOrganisation');
const createContact = require('./createContact');

async function createContactFromEmail(db, entrepriseId, payload = {}) {
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email) throw new Error('Email requis');

  const existing = await findContactByEmail(db, entrepriseId, email);
  if (existing) return { contact: existing, created: false };

  const orgName = String(payload.organisationName || payload.company || '').trim()
    || email.split('@')[1] || 'Prospect';

  const org = await createOrganisation(db, entrepriseId, {
    raisonSociale: orgName,
    type: 'entreprise',
    scope: 'externe',
    roles: ['prospect'],
    email: payload.organisationEmail || ''
  });

  const contact = await createContact(db, entrepriseId, {
    organisationId: org.organisationId,
    prenom: String(payload.prenom || payload.fromName || '').trim().split(/\s+/)[0] || '',
    nom: String(payload.nom || '').trim()
      || String(payload.fromName || '').trim().split(/\s+/).slice(1).join(' ') || orgName,
    email,
    telephone: String(payload.telephone || '').trim(),
    fonction: String(payload.fonction || '').trim(),
    principal: true,
    scope: 'externe'
  });

  return { contact, organisation: org, created: true };
}

module.exports = createContactFromEmail;
