/**
 * FICHIER : modules/gderpi/backend/services/clients/toClientSummaryEntry.js
 * RÔLE : Formate un client pour listes / autocomplétion (sans contacts ni adresses).
 *
 * ENTRÉES : doc Mongo
 * SORTIES : résumé client API ou null
 *
 * DÉPEND DE : toClientEntry.js
 * NE PAS : requêtes Mongo
 *
 * APPELÉ PAR : listClients.js
 */

const toClientEntry = require('./toClientEntry');

function toClientSummaryEntry(doc) {
  const full = toClientEntry(doc);
  if (!full) return null;

  const contacts = Array.isArray(full.contacts) ? full.contacts : [];
  const contactSearch = contacts.flatMap((ct) => [
    ct.prenom, ct.nom, ct.service, ct.fonction, ct.email, ct.telephone
  ]).filter(Boolean).join(' ');

  return {
    clientId: full.clientId,
    type: full.type,
    displayName: full.displayName,
    raisonSociale: full.raisonSociale,
    prenom: full.prenom,
    nom: full.nom,
    email: full.email,
    telephone: full.telephone,
    ville: full.ville,
    siret: full.siret,
    contactCount: contacts.length,
    contactSearch
  };
}

module.exports = toClientSummaryEntry;
