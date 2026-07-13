/**
 * FICHIER : modules/annuaire/backend/services/contacts/deleteContact.js
 */

const getContactById = require('./getContactById');

const COLLECTION = 'annuaire_contacts';

async function deleteContact(db, entrepriseId, contactId) {
  const existing = await getContactById(db, entrepriseId, contactId);
  const result = await db.collection(COLLECTION).deleteOne({
    entrepriseId: String(entrepriseId),
    contactId: String(contactId).trim()
  });

  if (result.deletedCount > 0 && existing?.organisationId) {
    try {
      const maybeSyncGderpiFromOrganisation = require('../integrations/gderpi/maybeSyncGderpiFromOrganisation');
      await maybeSyncGderpiFromOrganisation(db, entrepriseId, existing.organisationId);
    } catch (_) {
      /* sync optionnelle */
    }
  }

  return result.deletedCount > 0;
}

module.exports = deleteContact;
