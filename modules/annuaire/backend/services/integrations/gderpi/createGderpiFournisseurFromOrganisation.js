/**
 * FICHIER : modules/annuaire/backend/services/integrations/gderpi/createGderpiFournisseurFromOrganisation.js
 */

const path = require('path');
const isGderpiAvailable = require('../isGderpiAvailable');
const getOrganisationById = require('../../organisations/getOrganisationById');
const listContacts = require('../../contacts/listContacts');

async function createGderpiFournisseurFromOrganisation(db, entrepriseId, organisationId) {
  if (!isGderpiAvailable()) throw new Error('Module GDERPI non installé');

  const org = await getOrganisationById(db, entrepriseId, organisationId);
  if (!org) throw new Error('Organisation introuvable');
  if (org.gderpiFournisseurId) throw new Error('Fournisseur GDERPI déjà lié');

  const contacts = await listContacts(db, entrepriseId, { organisationId });
  const principal = contacts.find((c) => c.principal) || contacts[0] || null;

  const createFournisseur = require(path.join(
    __dirname,
    '../../../../../gderpi/backend/services/fournisseurs/createFournisseur.js'
  ));

  const fournisseur = await createFournisseur(db, entrepriseId, {
    raisonSociale: org.raisonSociale || org.nom || 'Fournisseur',
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
  return { organisation: updatedOrg, fournisseur };
}

module.exports = createGderpiFournisseurFromOrganisation;
