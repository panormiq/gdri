/**
 * FICHIER : modules/pm/backend/services/boards/toBoardEntry.js
 * RÔLE : Formate un document tableau pour l'API.
 */

function toBoardEntry(doc) {
  if (!doc) return null;
  return {
    id: doc.boardId,
    boardId: doc.boardId,
    entrepriseId: doc.entrepriseId,
    title: doc.title || 'Tableau principal',
    columns: Array.isArray(doc.columns) ? doc.columns : [],
    isDefault: doc.isDefault === true,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt
  };
}

module.exports = toBoardEntry;
