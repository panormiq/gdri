/**
 * FICHIER : modules/annuaire/backend/services/integrations/gderpi/syncGderpiClientFromOrganisation.js
 * RÔLE : Projette identité Annuaire vers le client GDERPI (contacts lus via enrich).
 */

const path = require('path');
const isGderpiAvailable = require('../isGderpiAvailable');
const getOrganisationById = require('../../organisations/getOrganisationById');
const listContacts = require('../../contacts/listContacts');

async function syncGderpiClientFromOrganisation(db, entrepriseId, organisationId) {
  if (!isGderpiAvailable()) return null;

  const org = await getOrganisationById(db, entrepriseId, organisationId);
  if (!org?.gderpiClientId) return null;

  const contacts = await listContacts(db, entrepriseId, { organisationId });
  const principal = contacts.find((c) => c.principal) || contacts[0] || null;
  const now = new Date();

  await db.collection('gderpi_clients').updateOne(
    { entrepriseId: String(entrepriseId), clientId: String(org.gderpiClientId) },
    {
      $set: {
        annuaireOrganisationId: org.organisationId,
        type: org.type,
        raisonSociale: org.raisonSociale,
        prenom: org.prenom,
        nom: org.nom,
        siret: org.siret,
        siteWeb: org.siteWeb,
        notes: org.notes,
        email: org.email || principal?.email || '',
        telephone: org.telephone || principal?.telephone || '',
        contactNom: principal ? `${principal.prenom || ''} ${principal.nom || ''}`.trim() : '',
        contactFonction: principal?.fonction || '',
        updatedAt: now
      },
      $unset: { contacts: '' }
    }
  );

  const getClientById = require(path.join(
    __dirname,
    '../../../../../gderpi/backend/services/clients/getClientById'
  ));
  return getClientById(db, entrepriseId, org.gderpiClientId);
}

module.exports = syncGderpiClientFromOrganisation;
