/**
 * FICHIER : modules/annuaire/backend/services/contacts/listContacts.js
 */

const ensureContactIndexes = require('./ensureContactIndexes');
const buildContactFilter = require('./buildContactFilter');
const toContactEntry = require('./toContactEntry');

async function listContacts(db, entrepriseId, options = {}) {
  await ensureContactIndexes(db);
  const filter = { entrepriseId: String(entrepriseId) };
  if (options.view === 'entity') {
    const orgFilter = await buildContactFilter(db, entrepriseId, null, { view: 'entity' });
    Object.assign(filter, orgFilter);
  } else if (options.organisationId) {
    const orgFilter = await buildContactFilter(db, entrepriseId, options.organisationId);
    Object.assign(filter, orgFilter);
  }
  if (options.scope) filter.scope = String(options.scope);
  if (options.serviceId) filter.serviceId = String(options.serviceId);
  if (options.ownerUserId) filter.ownerUserId = String(options.ownerUserId);
  if (options.search) {
    const q = String(options.search).trim();
    if (q) {
      const searchClause = {
        $or: [
          { prenom: { $regex: q, $options: 'i' } },
          { nom: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { fonction: { $regex: q, $options: 'i' } },
          { telephone: { $regex: q, $options: 'i' } }
        ]
      };
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, searchClause];
        delete filter.$or;
      } else {
        Object.assign(filter, searchClause);
      }
    }
  }

  const docs = await db.collection('annuaire_contacts')
    .find(filter)
    .sort({ principal: -1, nom: 1, prenom: 1 })
    .toArray();

  const orgIds = [...new Set(docs.map((d) => d.organisationId))];
  const orgs = await db.collection('annuaire_organisations')
    .find({ entrepriseId: String(entrepriseId), organisationId: { $in: orgIds } })
    .toArray();
  const orgById = Object.fromEntries(orgs.map((o) => [o.organisationId, o]));

  return docs.map((doc) => toContactEntry(doc, {
    organisationName: orgById[doc.organisationId]?.raisonSociale
      || orgById[doc.organisationId]?.nom || ''
  }));
}

module.exports = listContacts;
