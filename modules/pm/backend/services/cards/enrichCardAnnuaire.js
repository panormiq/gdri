/**
 * FICHIER : modules/pm/backend/services/cards/enrichCardAnnuaire.js
 * RÔLE : Enrichit une carte PM avec les données Annuaire à jour.
 */

const path = require('path');
const isAnnuaireAvailable = require('../integrations/annuaire/isAnnuaireAvailable');
const toCardEntry = require('./toCardEntry');

async function enrichCardAnnuaire(db, entrepriseId, doc) {
  if (!doc || !isAnnuaireAvailable()) return toCardEntry(doc);

  const entry = toCardEntry(doc);
  const contactId = entry.annuaire?.contactId;
  const organisationId = entry.annuaire?.organisationId;
  if (!contactId && !organisationId) return entry;

  try {
    if (contactId) {
      const getContactById = require(path.join(
        __dirname,
        '../../../../annuaire/backend/services/contacts/getContactById.js'
      ));
      const contact = await getContactById(db, entrepriseId, contactId);
      if (contact) {
        entry.annuaire = {
          ...(entry.annuaire || {}),
          contactId: contact.contactId,
          organisationId: contact.organisationId,
          contactName: contact.displayName,
          contactEmail: contact.email,
          organisationName: contact.organisationName || entry.annuaire?.organisationName || ''
        };
        entry.contactName = contact.displayName;
        entry.contactEmail = contact.email;
      }
    }
    if (organisationId || entry.annuaire?.organisationId) {
      const getOrganisationById = require(path.join(
        __dirname,
        '../../../../annuaire/backend/services/organisations/getOrganisationById.js'
      ));
      const org = await getOrganisationById(
        db,
        entrepriseId,
        organisationId || entry.annuaire.organisationId
      );
      if (org) {
        entry.annuaire = {
          ...(entry.annuaire || {}),
          organisationId: org.organisationId,
          organisationName: org.displayName,
          gderpiClientId: org.gderpiClientId || null,
          roles: org.roles || []
        };
      }
    }
  } catch (_) {
    // Annuaire indisponible — carte inchangée
  }

  return entry;
}

module.exports = enrichCardAnnuaire;
