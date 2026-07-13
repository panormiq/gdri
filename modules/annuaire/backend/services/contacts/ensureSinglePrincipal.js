/**
 * FICHIER : modules/annuaire/backend/services/contacts/ensureSinglePrincipal.js
 */

async function ensureSinglePrincipal(db, entrepriseId, organisationId, principalContactId) {
  if (!principalContactId) return;
  await db.collection('annuaire_contacts').updateMany(
    {
      entrepriseId: String(entrepriseId),
      organisationId: String(organisationId),
      contactId: { $ne: String(principalContactId) }
    },
    { $set: { principal: false, updatedAt: new Date() } }
  );
}

module.exports = ensureSinglePrincipal;
