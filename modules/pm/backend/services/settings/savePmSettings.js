/**
 * FICHIER : modules/pm/backend/services/settings/savePmSettings.js
 * RÔLE : Enregistre les paramètres PM de l'entreprise.
 */

const getPmSettings = require('./getPmSettings');

const COLLECTION = 'pm_settings';

async function savePmSettings(db, entrepriseId, patch = {}) {
  const now = new Date();
  const update = { updatedAt: now };
  if (patch.defaultBoutiqueId !== undefined) {
    update.defaultBoutiqueId = patch.defaultBoutiqueId
      ? String(patch.defaultBoutiqueId).trim()
      : null;
  }
  if (patch.inboxPollEnabled !== undefined) {
    update.inboxPollEnabled = patch.inboxPollEnabled === true;
  }

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId) },
    {
      $set: { entrepriseId: String(entrepriseId), ...update },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );

  return getPmSettings(db, entrepriseId);
}

module.exports = savePmSettings;
