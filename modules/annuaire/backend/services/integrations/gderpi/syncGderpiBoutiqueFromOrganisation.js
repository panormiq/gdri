/**
 * FICHIER : modules/annuaire/backend/services/integrations/gderpi/syncGderpiBoutiqueFromOrganisation.js
 * RÔLE : Projette une organisation Annuaire boutique vers gderpi_boutiques.
 */

const path = require('path');
const isGderpiAvailable = require('../isGderpiAvailable');
const getOrganisationById = require('../../organisations/getOrganisationById');
const listContacts = require('../../contacts/listContacts');

async function syncGderpiBoutiqueFromOrganisation(db, entrepriseId, organisationId) {
  if (!isGderpiAvailable()) return null;

  const org = await getOrganisationById(db, entrepriseId, organisationId);
  if (!org?.gderpiBoutiqueId) return null;

  const contacts = await listContacts(db, entrepriseId, { organisationId });
  const principal = contacts.find((c) => c.principal) || contacts[0] || null;
  const now = new Date();

  const existing = await db.collection('gderpi_boutiques').findOne({
    entrepriseId: String(entrepriseId),
    boutiqueId: String(org.gderpiBoutiqueId)
  });
  if (!existing) return null;

  const set = {
    annuaireOrganisationId: org.organisationId,
    raisonSociale: org.raisonSociale || existing.raisonSociale,
    siret: org.siret || existing.siret,
    formeJuridique: org.formeJuridique || existing.formeJuridique,
    tvaIntracommunautaire: org.tvaIntracommunautaire || existing.tvaIntracommunautaire,
    rcs: org.rcs || existing.rcs,
    capital: org.capitalSocial || existing.capital,
    adresse: org.adresse || existing.adresse,
    codePostal: org.codePostal || existing.codePostal,
    ville: org.ville || existing.ville,
    pays: org.pays || existing.pays,
    siteWeb: org.siteWeb ?? existing.siteWeb,
    email: org.email || principal?.email || existing.email,
    telephone: org.telephone || principal?.telephone || existing.telephone,
    logoUrl: org.logo || existing.logoUrl,
    isPrincipale: org.isPrimaryCompany === true,
    updatedAt: now
  };

  await db.collection('gderpi_boutiques').updateOne(
    { entrepriseId: String(entrepriseId), boutiqueId: String(org.gderpiBoutiqueId) },
    {
      $set: set,
      $unset: { contacts: '' }
    }
  );

  const getBoutiqueById = require(path.join(
    __dirname,
    '../../../../../gderpi/backend/services/boutiques/getBoutiqueById.js'
  ));
  return getBoutiqueById(db, entrepriseId, org.gderpiBoutiqueId);
}

module.exports = syncGderpiBoutiqueFromOrganisation;
