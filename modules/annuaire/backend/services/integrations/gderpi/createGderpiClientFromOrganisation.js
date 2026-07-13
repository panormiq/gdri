/**
 * FICHIER : modules/annuaire/backend/services/integrations/gderpi/createGderpiClientFromOrganisation.js
 */

const path = require('path');
const isGderpiAvailable = require('../isGderpiAvailable');
const getOrganisationById = require('../../organisations/getOrganisationById');
const listContacts = require('../../contacts/listContacts');

async function createGderpiClientFromOrganisation(db, entrepriseId, organisationId) {
  if (!isGderpiAvailable()) throw new Error('Module GDERPI non installé');

  const org = await getOrganisationById(db, entrepriseId, organisationId);
  if (!org) throw new Error('Organisation introuvable');
  if (org.gderpiClientId) throw new Error('Client GDERPI déjà lié');

  const contacts = await listContacts(db, entrepriseId, { organisationId });
  const principal = contacts.find((c) => c.principal) || contacts[0] || null;

  const createClient = require(path.join(
    __dirname,
    '../../../../../gderpi/backend/services/clients/createClient.js'
  ));

  const client = await createClient(db, entrepriseId, {
    type: org.type,
    raisonSociale: org.raisonSociale,
    prenom: org.prenom,
    nom: org.nom,
    siret: org.siret,
    email: org.email || principal?.email || '',
    telephone: org.telephone || principal?.telephone || '',
    siteWeb: org.siteWeb,
    notes: org.notes,
    contacts: contacts.map((c) => ({
      prenom: c.prenom,
      nom: c.nom,
      fonction: c.fonction,
      email: c.email,
      telephone: c.telephone,
      service: c.serviceLibelle || c.serviceLabel,
      principal: c.principal
    })),
    _fromAnnuaireOrganisationId: organisationId
  });

  const updatedOrg = await getOrganisationById(db, entrepriseId, organisationId);
  return { organisation: updatedOrg, client };
}

module.exports = createGderpiClientFromOrganisation;
