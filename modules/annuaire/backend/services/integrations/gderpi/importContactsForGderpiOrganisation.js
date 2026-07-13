/**
 * FICHIER : modules/annuaire/backend/services/integrations/gderpi/importContactsForGderpiOrganisation.js
 * RÔLE : Importe les contacts GDERPI sur une organisation (déduplication par org + e-mail).
 */

const createContact = require('../../contacts/createContact');

const CONTACT_COL = 'annuaire_contacts';

async function importContactsForGderpiOrganisation(db, entrepriseId, organisationId, contacts, scope) {
  const eid = String(entrepriseId);
  const orgId = String(organisationId).trim();
  let imported = 0;

  for (const ct of contacts || []) {
    const email = String(ct.email || '').trim().toLowerCase();
    const hasIdentity = email || ct.nom || ct.prenom || ct.telephone;
    if (!hasIdentity) continue;

    if (email) {
      const exists = await db.collection(CONTACT_COL).findOne({
        entrepriseId: eid,
        organisationId: orgId,
        email
      });
      if (exists) continue;
    }

    await createContact(db, entrepriseId, {
      organisationId: orgId,
      prenom: ct.prenom,
      nom: ct.nom,
      fonction: ct.fonction,
      email: ct.email,
      telephone: ct.telephone,
      serviceLibelle: ct.service,
      principal: ct.principal === true,
      scope: scope === 'interne' ? 'interne' : 'externe'
    });
    imported += 1;
  }

  return imported;
}

module.exports = importContactsForGderpiOrganisation;
