/**
 * Index collection paramètres GDERPI.
 */

const COLLECTION = 'gderpi_settings';
let indexed = false;

async function ensureDevisMailSettingsIndexes(db) {
  if (indexed) return;
  const col = db.collection(COLLECTION);
  await col.createIndex({ entrepriseId: 1, settingKey: 1 }, { unique: true });
  indexed = true;
}

module.exports = ensureDevisMailSettingsIndexes;
