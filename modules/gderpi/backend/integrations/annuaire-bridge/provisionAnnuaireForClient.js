/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/provisionAnnuaireForClient.js
 * RÔLE : Crée ou lie une organisation Annuaire pour un nouveau client GDERPI.
 */

const path = require('path');

async function provisionAnnuaireForClient(db, entrepriseId, normalized, rawData = {}) {
  const createOrganisation = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/organisations/createOrganisation'
  ));
  const createContact = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/contacts/createContact'
  ));
  const getOrganisationById = require(path.join(
    __dirname,
    '../../../../annuaire/backend/services/organisations/getOrganisationById'
  ));

  const fromAnnuaire = String(rawData._fromAnnuaireOrganisationId || '').trim();
  const requestedOrgId = fromAnnuaire || String(rawData.annuaireOrganisationId || '').trim();

  if (requestedOrgId) {
    const org = await getOrganisationById(db, entrepriseId, requestedOrgId);
    if (!org) throw new Error('Organisation annuaire introuvable');
    if (org.gderpiClientId) throw new Error('Cette organisation est déjà liée à un client GDERPI');
    return requestedOrgId;
  }

  const org = await createOrganisation(db, entrepriseId, {
    type: normalized.type,
    raisonSociale: normalized.raisonSociale,
    prenom: normalized.prenom,
    nom: normalized.nom,
    siret: normalized.siret,
    email: normalized.email,
    telephone: normalized.telephone,
    siteWeb: normalized.siteWeb,
    notes: normalized.notes,
    scope: 'externe',
    roles: ['client']
  });

  const contacts = normalized.type === 'entreprise'
    ? (Array.isArray(normalized.contacts) ? normalized.contacts : [])
    : [{
      prenom: normalized.prenom,
      nom: normalized.nom,
      email: normalized.email,
      telephone: normalized.telephone,
      principal: true
    }];

  for (const ct of contacts) {
    if (!ct.email && !ct.nom && !ct.prenom && !ct.telephone) continue;
    await createContact(db, entrepriseId, {
      organisationId: org.organisationId,
      prenom: ct.prenom,
      nom: ct.nom,
      fonction: ct.fonction,
      email: ct.email,
      telephone: ct.telephone,
      serviceLibelle: ct.service,
      principal: ct.principal === true,
      scope: 'externe'
    });
  }

  return org.organisationId;
}

module.exports = provisionAnnuaireForClient;
