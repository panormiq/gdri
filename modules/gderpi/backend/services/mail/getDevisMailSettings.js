/**
 * Lit les paramètres e-mail devis pour une entreprise.
 */

const ensureDevisMailSettingsIndexes = require('./ensureDevisMailSettingsIndexes');
const normalizeDevisMailSettings = require('./normalizeDevisMailSettings');
const { checkMailAvailable } = require('./MailHelper');

const COLLECTION = 'gderpi_settings';
const SETTING_KEY = 'devis_mail';

async function getDevisMailSettings(db, entrepriseId) {
  await ensureDevisMailSettingsIndexes(db);
  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    settingKey: SETTING_KEY
  });
  const settings = normalizeDevisMailSettings(doc?.value || {});
  const mailStatus = await checkMailAvailable(entrepriseId);
  return {
    ...settings,
    mailAvailable: mailStatus.available,
    mailStatusMessage: mailStatus.message
  };
}

module.exports = getDevisMailSettings;
