/**
 * FICHIER : modules/doc-hub/backend/services/projects/getProjectById.js
 * RÔLE : Récupère un projet par son id.
 */

const toProjectObjectId = require('./toProjectObjectId');

async function getProjectById(entrepriseDb, id) {
  return entrepriseDb.collection('doc_hub_projects').findOne({ _id: toProjectObjectId(id) });
}

module.exports = getProjectById;
