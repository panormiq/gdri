/**
 * FICHIER : modules/chat/backend/services/utils/parseObjectId.js
 * RÔLE : Parse un ObjectId Mongo ; retourne null si invalide.
 */

const { ObjectId } = require('mongodb');

function parseObjectId(value) {
  try {
    return new ObjectId(value);
  } catch (_) {
    return null;
  }
}

module.exports = parseObjectId;
