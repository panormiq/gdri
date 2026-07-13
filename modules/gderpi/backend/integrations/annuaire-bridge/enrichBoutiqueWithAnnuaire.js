/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/enrichBoutiqueWithAnnuaire.js
 * RÔLE : Fusionne identité + contacts Annuaire dans une entrée boutique GDERPI API.
 */

const path = require('path');
const isAnnuaireAvailable = require('./isAnnuaireAvailable');
const mapAnnuaireContactsToGderpi = require('./mapAnnuaireContactsToGderpi');
const toBoutiqueEntry = require('../../services/boutiques/toBoutiqueEntry');

async function enrichBoutiqueWithAnnuaire(db, entrepriseId, boutiqueEntry) {
  if (!boutiqueEntry || !isAnnuaireAvailable()) return boutiqueEntry;

  let organisationId = String(boutiqueEntry.annuaireOrganisationId || '').trim();

  const getOrganisationById = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/organisations/getOrganisationById.js'
  ));
  const listContacts = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/contacts/listContacts.js'
  ));

  if (!organisationId && boutiqueEntry.boutiqueId) {
    const org = await db.collection('annuaire_organisations').findOne({
      entrepriseId: String(entrepriseId),
      gderpiBoutiqueId: String(boutiqueEntry.boutiqueId)
    });
    if (org?.organisationId) {
      organisationId = org.organisationId;
      await db.collection('gderpi_boutiques').updateOne(
        { entrepriseId: String(entrepriseId), boutiqueId: String(boutiqueEntry.boutiqueId) },
        { $set: { annuaireOrganisationId: organisationId, updatedAt: new Date() } }
      );
    }
  }

  if (!organisationId) return { ...boutiqueEntry, annuaireLinked: false };

  const org = await getOrganisationById(db, entrepriseId, organisationId);
  if (!org) return { ...boutiqueEntry, annuaireLinked: false };

  const contacts = await listContacts(db, entrepriseId, { organisationId });
  const principal = contacts.find((c) => c.principal) || contacts[0] || null;
  const gderpiContacts = mapAnnuaireContactsToGderpi(contacts);

  const merged = toBoutiqueEntry({
    ...boutiqueEntry,
    annuaireOrganisationId: organisationId,
    raisonSociale: org.raisonSociale ?? boutiqueEntry.raisonSociale,
    siret: org.siret ?? boutiqueEntry.siret,
    siteWeb: org.siteWeb ?? boutiqueEntry.siteWeb,
    contacts: gderpiContacts,
    email: org.email || principal?.email || boutiqueEntry.email,
    telephone: org.telephone || principal?.telephone || boutiqueEntry.telephone
  });

  return {
    ...merged,
    annuaireLinked: true,
    annuaireOrganisationId: organisationId
  };
}

module.exports = enrichBoutiqueWithAnnuaire;
