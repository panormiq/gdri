/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/enrichClientWithAnnuaire.js
 * RÔLE : Fusionne identité + contacts Annuaire dans une entrée client GDERPI API.
 */

const path = require('path');
const isAnnuaireAvailable = require('./isAnnuaireAvailable');
const mapAnnuaireContactsToGderpi = require('./mapAnnuaireContactsToGderpi');
const toClientEntry = require('../../services/clients/toClientEntry');

async function enrichClientWithAnnuaire(db, entrepriseId, clientEntry) {
  if (!clientEntry || !isAnnuaireAvailable()) return clientEntry;

  const orgId = String(clientEntry.annuaireOrganisationId || '').trim();
  let organisationId = orgId;

  const getOrganisationById = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/organisations/getOrganisationById'
  ));
  const listContacts = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/contacts/listContacts'
  ));

  if (!organisationId && clientEntry.clientId) {
    const org = await db.collection('annuaire_organisations').findOne({
      entrepriseId: String(entrepriseId),
      gderpiClientId: String(clientEntry.clientId)
    });
    if (org?.organisationId) {
      organisationId = org.organisationId;
      await db.collection('gderpi_clients').updateOne(
        { entrepriseId: String(entrepriseId), clientId: String(clientEntry.clientId) },
        { $set: { annuaireOrganisationId: organisationId, updatedAt: new Date() } }
      );
    }
  }

  if (!organisationId) return { ...clientEntry, annuaireLinked: false };

  const org = await getOrganisationById(db, entrepriseId, organisationId);
  if (!org) return { ...clientEntry, annuaireLinked: false };

  const contacts = await listContacts(db, entrepriseId, { organisationId });
  const principal = contacts.find((c) => c.principal) || contacts[0] || null;
  const gderpiContacts = mapAnnuaireContactsToGderpi(contacts);

  const merged = toClientEntry({
    ...clientEntry,
    annuaireOrganisationId: organisationId,
    type: org.type || clientEntry.type,
    raisonSociale: org.raisonSociale ?? clientEntry.raisonSociale,
    prenom: org.prenom ?? clientEntry.prenom,
    nom: org.nom ?? clientEntry.nom,
    siret: org.siret ?? clientEntry.siret,
    siteWeb: org.siteWeb ?? clientEntry.siteWeb,
    notes: org.notes ?? clientEntry.notes,
    contacts: gderpiContacts,
    email: org.email || principal?.email || clientEntry.email,
    telephone: org.telephone || principal?.telephone || clientEntry.telephone,
    contactNom: principal ? `${principal.prenom || ''} ${principal.nom || ''}`.trim() : clientEntry.contactNom,
    contactFonction: principal?.fonction || clientEntry.contactFonction
  });

  return {
    ...merged,
    annuaireLinked: true,
    annuaireOrganisationId: organisationId
  };
}

module.exports = enrichClientWithAnnuaire;
