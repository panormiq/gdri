/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/enrichFournisseurWithAnnuaire.js
 * RÔLE : Fusionne identité + contacts Annuaire dans une entrée fournisseur GDERPI API.
 */

const path = require('path');
const isAnnuaireAvailable = require('./isAnnuaireAvailable');
const mapAnnuaireContactsToGderpi = require('./mapAnnuaireContactsToGderpi');
const toFournisseurEntry = require('../../services/fournisseurs/toFournisseurEntry');

async function enrichFournisseurWithAnnuaire(db, entrepriseId, fournisseurEntry) {
  if (!fournisseurEntry || !isAnnuaireAvailable()) return fournisseurEntry;

  let organisationId = String(fournisseurEntry.annuaireOrganisationId || '').trim();

  const getOrganisationById = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/organisations/getOrganisationById'
  ));
  const listContacts = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/contacts/listContacts'
  ));

  if (!organisationId && fournisseurEntry.fournisseurId) {
    const org = await db.collection('annuaire_organisations').findOne({
      entrepriseId: String(entrepriseId),
      gderpiFournisseurId: String(fournisseurEntry.fournisseurId)
    });
    if (org?.organisationId) {
      organisationId = org.organisationId;
      await db.collection('gderpi_fournisseurs').updateOne(
        { entrepriseId: String(entrepriseId), fournisseurId: String(fournisseurEntry.fournisseurId) },
        { $set: { annuaireOrganisationId: organisationId, updatedAt: new Date() } }
      );
    }
  }

  if (!organisationId) return { ...fournisseurEntry, annuaireLinked: false };

  const org = await getOrganisationById(db, entrepriseId, organisationId);
  if (!org) return { ...fournisseurEntry, annuaireLinked: false };

  const contacts = await listContacts(db, entrepriseId, { organisationId });
  const principal = contacts.find((c) => c.principal) || contacts[0] || null;
  const gderpiContacts = mapAnnuaireContactsToGderpi(contacts);

  const merged = toFournisseurEntry({
    ...fournisseurEntry,
    annuaireOrganisationId: organisationId,
    raisonSociale: org.raisonSociale ?? fournisseurEntry.raisonSociale,
    siret: org.siret ?? fournisseurEntry.siret,
    siteWeb: org.siteWeb ?? fournisseurEntry.siteWeb,
    notes: org.notes ?? fournisseurEntry.notes,
    contacts: gderpiContacts,
    email: org.email || principal?.email || fournisseurEntry.email,
    telephone: org.telephone || principal?.telephone || fournisseurEntry.telephone,
    contactNom: principal ? `${principal.prenom || ''} ${principal.nom || ''}`.trim() : fournisseurEntry.contactNom,
    contactFonction: principal?.fonction || fournisseurEntry.contactFonction
  });

  return {
    ...merged,
    annuaireLinked: true,
    annuaireOrganisationId: organisationId
  };
}

module.exports = enrichFournisseurWithAnnuaire;
