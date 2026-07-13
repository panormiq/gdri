/**
 * FICHIER : modules/annuaire/backend/services/contacts/findContactByEmail.js
 */

const ensureContactIndexes = require('./ensureContactIndexes');
const toContactEntry = require('./toContactEntry');

async function findContactByEmail(db, entrepriseId, email) {
  await ensureContactIndexes(db);
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;

  const doc = await db.collection('annuaire_contacts').findOne({
    entrepriseId: String(entrepriseId),
    email: normalized
  });
  return toContactEntry(doc);
}

module.exports = findContactByEmail;
