/**
 * FICHIER : modules/annuaire/backend/services/integrations/gderpi/importFromGderpi.js
 * RÔLE : Import organisations + contacts depuis GDERPI (clients, fournisseurs, boutiques).
 */

const isGderpiAvailable = require('../isGderpiAvailable');
const upsertOrganisationFromGderpi = require('./upsertOrganisationFromGderpi');
const importContactsForGderpiOrganisation = require('./importContactsForGderpiOrganisation');
const importBoutiquesFromGderpi = require('./importBoutiquesFromGderpi');
const ensureOrganisationIndexes = require('../../organisations/ensureOrganisationIndexes');
const ensureContactIndexes = require('../../contacts/ensureContactIndexes');

async function importFromGderpi(db, entrepriseId) {
  if (!isGderpiAvailable()) {
    throw new Error('Module GDERPI non installé');
  }

  await ensureOrganisationIndexes(db);
  await ensureContactIndexes(db);

  const eid = String(entrepriseId);
  const stats = {
    organisationsCreated: 0,
    organisationsUpdated: 0,
    contactsImported: 0,
    clients: 0,
    fournisseurs: 0,
    boutiques: 0
  };

  const clients = await db.collection('gderpi_clients').find({ entrepriseId: eid }).toArray();
  for (const client of clients) {
    const type = client.type === 'particulier' ? 'particulier' : 'entreprise';
    const { org, created } = await upsertOrganisationFromGderpi(db, entrepriseId, {
      organisationId: `gderpi-client-${client.clientId}`,
      raisonSociale: client.raisonSociale || client.contactNom || 'Client',
      prenom: client.prenom || '',
      nom: client.nom || '',
      type,
      scope: 'externe',
      roles: ['client'],
      siret: client.siret || '',
      email: client.email || '',
      telephone: client.telephone || '',
      siteWeb: client.siteWeb || '',
      notes: client.notes || '',
      gderpiClientId: client.clientId
    });
    if (created) stats.organisationsCreated += 1;
    else stats.organisationsUpdated += 1;
    await db.collection('gderpi_clients').updateOne(
      { entrepriseId: eid, clientId: client.clientId },
      { $set: { annuaireOrganisationId: org.organisationId, updatedAt: new Date() } }
    );
    stats.contactsImported += await importContactsForGderpiOrganisation(
      db, entrepriseId, org.organisationId, client.contacts, 'externe'
    );
    stats.clients += 1;
  }

  const fournisseurs = await db.collection('gderpi_fournisseurs').find({ entrepriseId: eid }).toArray();
  for (const frs of fournisseurs) {
    const { org, created } = await upsertOrganisationFromGderpi(db, entrepriseId, {
      organisationId: `gderpi-frs-${frs.fournisseurId}`,
      raisonSociale: frs.raisonSociale || frs.contactNom || 'Fournisseur',
      type: 'entreprise',
      scope: 'externe',
      roles: ['fournisseur'],
      siret: frs.siret || '',
      email: frs.email || '',
      telephone: frs.telephone || '',
      gderpiFournisseurId: frs.fournisseurId
    });
    if (created) stats.organisationsCreated += 1;
    else stats.organisationsUpdated += 1;
    await db.collection('gderpi_fournisseurs').updateOne(
      { entrepriseId: eid, fournisseurId: frs.fournisseurId },
      { $set: { annuaireOrganisationId: org.organisationId, updatedAt: new Date() } }
    );
    stats.contactsImported += await importContactsForGderpiOrganisation(
      db, entrepriseId, org.organisationId, frs.contacts, 'externe'
    );
    stats.fournisseurs += 1;
  }

  const boutiqueStats = await importBoutiquesFromGderpi(db, entrepriseId);
  stats.boutiques = boutiqueStats.boutiques;
  stats.organisationsCreated += boutiqueStats.organisationsCreated;
  stats.organisationsUpdated += boutiqueStats.organisationsUpdated;
  stats.contactsImported += boutiqueStats.contactsImported;

  return stats;
}

module.exports = importFromGderpi;
