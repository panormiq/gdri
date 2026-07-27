/**
 * FICHIER : modules/doc-hub/backend/services/projects/toProjectObjectId.js
 * RÔLE : Convertit un id texte en ObjectId Mongo (erreur si invalide).
 */

const { ObjectId } = require('mongodb');

function toProjectObjectId(id) {
  if (!ObjectId.isValid(id)) throw new Error('ID invalide');
  return new ObjectId(id);
}

module.exports = toProjectObjectId;
