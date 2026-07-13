/**
 * FICHIER : modules/annuaire/backend/services/integrations/gderpi/syncGderpiFournisseurFromOrganisation.js
 * RÔLE : Projette une organisation Annuaire (+ contacts) vers le fournisseur GDERPI lié.
 */

const path = require('path');
const isGderpiAvailable = require('../isGderpiAvailable');
const getOrganisationById = require('../../organisations/getOrganisationById');
const listContacts = require('../../contacts/listContacts');

async function syncGderpiFournisseurFromOrganisation(db, entrepriseId, organisationId) {
  if (!isGderpiAvailable()) return null;

  const org = await getOrganisationById(db, entrepriseId, organisationId);
  if (!org?.gderpiFournisseurId) return null;

  const contacts = await listContacts(db, entrepriseId, { organisationId });
  const principal = contacts.find((c) => c.principal) || contacts[0] || null;
  const now = new Date();

  await db.collection('gderpi_fournisseurs').updateOne(
    { entrepriseId: String(entrepriseId), fournisseurId: String(org.gderpiFournisseurId) },
    {
      $set: {
        annuaireOrganisationId: org.organisationId,
        raisonSociale: org.raisonSociale,
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

  const getFournisseurById = require(path.join(
    __dirname,
    '../../../../../gderpi/backend/services/fournisseurs/getFournisseurById'
  ));
  return getFournisseurById(db, entrepriseId, org.gderpiFournisseurId);
}

module.exports = syncGderpiFournisseurFromOrganisation;
