/**
 * FICHIER : modules/annuaire/backend/services/contacts/getContactById.js
 */

const ensureContactIndexes = require('./ensureContactIndexes');
const toContactEntry = require('./toContactEntry');

async function getContactById(db, entrepriseId, contactId) {
  await ensureContactIndexes(db);
  const doc = await db.collection('annuaire_contacts').findOne({
    entrepriseId: String(entrepriseId),
    contactId: String(contactId).trim()
  });
  if (!doc) return null;

  const org = await db.collection('annuaire_organisations').findOne({
    entrepriseId: String(entrepriseId),
    organisationId: doc.organisationId
  });
  let serviceLabel = doc.serviceLibelle || '';
  if (doc.serviceId) {
    const svc = await db.collection('annuaire_services').findOne({
      entrepriseId: String(entrepriseId),
      serviceId: doc.serviceId
    });
    if (svc) serviceLabel = svc.libelle || serviceLabel;
  }

  return toContactEntry(doc, {
    organisationName: org?.raisonSociale || org?.nom || '',
    serviceLabel
  });
}

module.exports = getContactById;
