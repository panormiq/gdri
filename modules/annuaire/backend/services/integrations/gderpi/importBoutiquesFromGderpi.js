/**
 * FICHIER : modules/annuaire/backend/services/integrations/gderpi/importBoutiquesFromGderpi.js
 * RÔLE : Importe les boutiques GDERPI comme organisations internes Annuaire + contacts.
 */

const upsertOrganisationFromGderpi = require('./upsertOrganisationFromGderpi');
const importContactsForGderpiOrganisation = require('./importContactsForGderpiOrganisation');
const buildBoutiqueAnnuaireNotes = require('./buildBoutiqueAnnuaireNotes');
const removeRedundantOwnOrganisation = require('../../organisations/removeRedundantOwnOrganisation');

async function importBoutiquesFromGderpi(db, entrepriseId) {
  const eid = String(entrepriseId);
  const stats = { boutiques: 0, organisationsCreated: 0, organisationsUpdated: 0, contactsImported: 0 };

  const boutiques = await db.collection('gderpi_boutiques').find({ entrepriseId: eid }).toArray();
  for (const boutique of boutiques) {
    const label = String(boutique.raisonSociale || boutique.nom || 'Boutique').trim();
    const { org, created } = await upsertOrganisationFromGderpi(db, entrepriseId, {
      organisationId: `gderpi-boutique-${boutique.boutiqueId}`,
      raisonSociale: label,
      type: 'entreprise',
      scope: 'interne',
      roles: ['boutique'],
      siret: boutique.siret || '',
      email: boutique.email || '',
      telephone: boutique.telephone || '',
      siteWeb: boutique.siteWeb || '',
      notes: buildBoutiqueAnnuaireNotes(boutique),
      gderpiBoutiqueId: boutique.boutiqueId
    });

    if (created) stats.organisationsCreated += 1;
    else stats.organisationsUpdated += 1;

    await db.collection('gderpi_boutiques').updateOne(
      { entrepriseId: eid, boutiqueId: boutique.boutiqueId },
      { $set: { annuaireOrganisationId: org.organisationId, updatedAt: new Date() } }
    );

    stats.contactsImported += await importContactsForGderpiOrganisation(
      db,
      entrepriseId,
      org.organisationId,
      boutique.contacts,
      'interne'
    );
    stats.boutiques += 1;
  }

  await removeRedundantOwnOrganisation(db, entrepriseId);

  return stats;
}

module.exports = importBoutiquesFromGderpi;
