/**
 * FICHIER : modules/annuaire/backend/services/contacts/createContact.js
 */

const ensureContactIndexes = require('./ensureContactIndexes');
const getOrganisationById = require('../organisations/getOrganisationById');
const normalizeContact = require('./normalizeContact');
const ensureSinglePrincipal = require('./ensureSinglePrincipal');
const getContactById = require('./getContactById');

const COLLECTION = 'annuaire_contacts';

async function createContact(db, entrepriseId, data = {}, meta = {}) {
  await ensureContactIndexes(db);
  const normalized = normalizeContact(data);
  if (!normalized.organisationId) throw new Error('organisationId requis');
  if (!normalized.nom && !normalized.prenom && !normalized.email) {
    throw new Error('Nom ou email requis');
  }

  const actorUserId = meta.actorUserId != null ? String(meta.actorUserId).trim() || null : null;
  const ownerUserId = normalized.ownerUserId || actorUserId || null;

  const org = await getOrganisationById(db, entrepriseId, normalized.organisationId);
  if (!org) throw new Error('Organisation introuvable');

  const scope = normalized.scope || org.scope || 'externe';
  let serviceLibelle = normalized.serviceLibelle;
  if (normalized.serviceId) {
    const svc = await db.collection('annuaire_services').findOne({
      entrepriseId: String(entrepriseId),
      serviceId: normalized.serviceId,
      organisationId: normalized.organisationId
    });
    if (svc) serviceLibelle = svc.libelle;
  }

  const now = new Date();
  const doc = {
    entrepriseId: String(entrepriseId),
    contactId: normalized.id,
    organisationId: normalized.organisationId,
    serviceId: normalized.serviceId,
    serviceLibelle,
    prenom: normalized.prenom,
    nom: normalized.nom,
    fonction: normalized.fonction,
    email: normalized.email,
    telephone: normalized.telephone,
    scope,
    principal: normalized.principal,
    userId: normalized.userId,
    ownerUserId,
    createdByUserId: actorUserId || normalized.createdByUserId || ownerUserId,
    notes: normalized.notes,
    createdAt: now,
    updatedAt: now
  };

  if (doc.principal) {
    await ensureSinglePrincipal(db, entrepriseId, doc.organisationId, doc.contactId);
  } else {
    const count = await db.collection(COLLECTION).countDocuments({
      entrepriseId: String(entrepriseId),
      organisationId: doc.organisationId
    });
    if (count === 0) doc.principal = true;
  }

  await db.collection(COLLECTION).insertOne(doc);
  const created = await getContactById(db, entrepriseId, doc.contactId);

  try {
    const maybeSyncGderpiFromOrganisation = require('../integrations/gderpi/maybeSyncGderpiFromOrganisation');
    await maybeSyncGderpiFromOrganisation(db, entrepriseId, doc.organisationId);
  } catch (_) {
    /* sync optionnelle */
  }

  return created;
}

module.exports = createContact;
