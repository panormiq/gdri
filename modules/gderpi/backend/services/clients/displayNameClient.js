/**
 * FICHIER : modules/gderpi/backend/services/clients/displayNameClient.js
 * RÔLE : Calcule le nom affiché d'un client.
 *
 * ENTRÉES : client normalisé ou brut
 * SORTIES : string
 *
 * DÉPEND DE : normalizeClient.js
 * NE PAS : Mongo
 *
 * APPELÉ PAR : toClientEntry.js
 */

const normalizeClient = require('./normalizeClient');

function displayNameClient(client) {
  const c = normalizeClient(client);
  if (c.type === 'particulier') {
    const full = `${c.prenom} ${c.nom}`.trim();
    return full || c.raisonSociale || 'Client particulier';
  }
  return c.raisonSociale || 'Client entreprise';
}

module.exports = displayNameClient;
