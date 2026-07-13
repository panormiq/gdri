/**
 * FICHIER : modules/pm/backend/services/cards/toCardEntry.js
 * RÔLE : Formate une carte PM pour l'API.
 */

function iso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function toCardEntry(doc) {
  if (!doc) return null;
  return {
    id: doc.cardId,
    cardId: doc.cardId,
    boardId: doc.boardId,
    columnId: doc.columnId,
    entrepriseId: doc.entrepriseId,
    title: doc.title || '',
    description: doc.description || '',
    type: doc.type || 'demande',
    status: doc.status || 'open',
    priority: doc.priority || 'normal',
    contactName: doc.contactName || '',
    contactEmail: doc.contactEmail || '',
    annuaire: doc.annuaire && typeof doc.annuaire === 'object' ? doc.annuaire : null,
    sourceEmail: doc.sourceEmail || null,
    gderpi: doc.gderpi || null,
    tasks: Array.isArray(doc.tasks) ? doc.tasks : [],
    activities: Array.isArray(doc.activities) ? doc.activities.map((a) => ({
      ...a,
      date: iso(a.date)
    })) : [],
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt)
  };
}

module.exports = toCardEntry;
