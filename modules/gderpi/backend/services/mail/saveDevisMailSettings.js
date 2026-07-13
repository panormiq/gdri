/**
 * Enregistre les paramètres e-mail devis pour une entreprise.
 */

const ensureDevisMailSettingsIndexes = require('./ensureDevisMailSettingsIndexes');
const normalizeDevisMailSettings = require('./normalizeDevisMailSettings');
const getDevisMailSettings = require('./getDevisMailSettings');

const COLLECTION = 'gderpi_settings';
const SETTING_KEY = 'devis_mail';

async function saveDevisMailSettings(db, entrepriseId, payload) {
  await ensureDevisMailSettingsIndexes(db);
  const value = normalizeDevisMailSettings(payload || {});
  const now = new Date();

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), settingKey: SETTING_KEY },
    {
      $set: {
        entrepriseId: String(entrepriseId),
        settingKey: SETTING_KEY,
        value,
        updatedAt: now
      },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );

  return getDevisMailSettings(db, entrepriseId);
}

module.exports = saveDevisMailSettings;
