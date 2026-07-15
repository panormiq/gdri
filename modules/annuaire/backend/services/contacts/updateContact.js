/**
 * FICHIER : modules/annuaire/backend/services/contacts/updateContact.js
 */

const getContactById = require('./getContactById');
const ensureSinglePrincipal = require('./ensureSinglePrincipal');

const COLLECTION = 'annuaire_contacts';

async function updateContact(db, entrepriseId, contactId, patch = {}) {
  const existing = await getContactById(db, entrepriseId, contactId);
  if (!existing) throw new Error('Contact introuvable');

  const p = patch && typeof patch === 'object' ? patch : {};
  const update = { updatedAt: new Date() };

  if (p.prenom !== undefined) update.prenom = String(p.prenom || '').trim();
  if (p.nom !== undefined) update.nom = String(p.nom || '').trim();
  if (p.fonction !== undefined) update.fonction = String(p.fonction || '').trim();
  if (p.email !== undefined) update.email = String(p.email || '').trim().toLowerCase();
  if (p.telephone !== undefined) update.telephone = String(p.telephone || '').trim();
  if (p.notes !== undefined) update.notes = String(p.notes || '').trim();
  if (p.userId !== undefined) update.userId = p.userId ? String(p.userId).trim() : null;
  if (p.ownerUserId !== undefined) update.ownerUserId = p.ownerUserId ? String(p.ownerUserId).trim() : null;
  if (p.scope !== undefined) update.scope = String(p.scope || 'externe');
  if (p.serviceId !== undefined) {
    update.serviceId = p.serviceId ? String(p.serviceId).trim() : null;
    if (update.serviceId) {
      const svc = await db.collection('annuaire_services').findOne({
        entrepriseId: String(entrepriseId),
        serviceId: update.serviceId
      });
      update.serviceLibelle = svc?.libelle || '';
    }
  }
  if (p.serviceLibelle !== undefined) update.serviceLibelle = String(p.serviceLibelle || '').trim();
  if (p.principal === true) {
    update.principal = true;
    await ensureSinglePrincipal(db, entrepriseId, existing.organisationId, contactId);
  }

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), contactId: String(contactId).trim() },
    { $set: update }
  );

  const updated = await getContactById(db, entrepriseId, contactId);

  try {
    const maybeSyncGderpiFromOrganisation = require('../integrations/gderpi/maybeSyncGderpiFromOrganisation');
    await maybeSyncGderpiFromOrganisation(db, entrepriseId, existing.organisationId);
  } catch (_) {
    /* sync optionnelle */
  }

  return updated;
}

module.exports = updateContact;
