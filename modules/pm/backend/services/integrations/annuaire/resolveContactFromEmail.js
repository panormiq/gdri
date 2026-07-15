/**
 * FICHIER : modules/pm/backend/services/integrations/annuaire/resolveContactFromEmail.js
 * RÔLE : Résout ou crée un contact Annuaire depuis un e-mail entrant (pont optionnel).
 */

const path = require('path');
const isAnnuaireAvailable = require('./isAnnuaireAvailable');

function splitFromName(fromName) {
  const parts = String(fromName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { prenom: '', nom: '' };
  if (parts.length === 1) return { prenom: '', nom: parts[0] };
  return { prenom: parts[0], nom: parts.slice(1).join(' ') };
}

async function resolveContactFromEmail(db, entrepriseId, email, options = {}) {
  if (!isAnnuaireAvailable()) {
    return null;
  }

  const fromEmail = String(email.fromEmail || email.from || '').trim().toLowerCase();
  if (!fromEmail) return null;

  const ownerUserId = options.ownerUserId || email.ownerUserId || options.actorUserId || null;
  const meta = { actorUserId: ownerUserId };

  const findContactByEmail = require(path.join(
    __dirname,
    '../../../../../annuaire/backend/services/contacts/findContactByEmail.js'
  ));
  const createContactFromEmail = require(path.join(
    __dirname,
    '../../../../../annuaire/backend/services/contacts/createContactFromEmail.js'
  ));
  const getOrganisationById = require(path.join(
    __dirname,
    '../../../../../annuaire/backend/services/organisations/getOrganisationById.js'
  ));

  let contact = await findContactByEmail(db, entrepriseId, fromEmail);
  let organisation = null;
  let created = false;

  if (!contact) {
    const names = splitFromName(email.fromName);
    const result = await createContactFromEmail(db, entrepriseId, {
      email: fromEmail,
      fromName: email.fromName,
      prenom: names.prenom,
      nom: names.nom,
      organisationName: email.organisationName || '',
      ownerUserId
    }, meta);
    contact = result.contact;
    organisation = result.organisation || null;
    created = result.created === true;
  } else if (contact.organisationId) {
    organisation = await getOrganisationById(db, entrepriseId, contact.organisationId);
  }

  return {
    contact,
    organisation,
    created,
    contactId: contact?.contactId || contact?.id,
    organisationId: contact?.organisationId || organisation?.organisationId,
    contactName: contact?.displayName || `${contact?.prenom || ''} ${contact?.nom || ''}`.trim(),
    contactEmail: contact?.email || fromEmail,
    organisationName: organisation?.displayName || organisation?.raisonSociale || contact?.organisationName || '',
    gderpiClientId: organisation?.gderpiClientId || null
  };
}

module.exports = resolveContactFromEmail;
