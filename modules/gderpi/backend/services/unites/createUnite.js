/**
 * FICHIER : modules/gderpi/backend/services/unites/createUnite.js
 */

const ensureUniteIndexes = require('./ensureUniteIndexes');
const normalizeUnite = require('./normalizeUnite');
const toUniteEntry = require('./toUniteEntry');

const COLLECTION = 'gderpi_unites';

async function createUnite(db, entrepriseId, data) {
  await ensureUniteIndexes(db);
  const col = db.collection(COLLECTION);
  const eid = String(entrepriseId);
  const normalized = normalizeUnite(data);
  if (!normalized.libelle) throw new Error('Libellé unité requis');
  const taken = await col.findOne({ entrepriseId: eid, code: normalized.code });
  if (taken) throw new Error('Ce code unité existe déjà');
  const now = new Date();
  const doc = {
    entrepriseId: eid,
    uniteId: normalized.id,
    ...normalized,
    createdAt: now,
    updatedAt: now
  };
  await col.insertOne(doc);
  return toUniteEntry(doc);
}

module.exports = createUnite;
