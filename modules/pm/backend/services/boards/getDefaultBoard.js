/**
 * FICHIER : modules/pm/backend/services/boards/getDefaultBoard.js
 * RÔLE : Retourne le tableau PM par défaut (création si absent).
 */

const seedDefaultBoard = require('./seedDefaultBoard');

async function getDefaultBoard(db, entrepriseId) {
  return seedDefaultBoard(db, entrepriseId);
}

module.exports = getDefaultBoard;
