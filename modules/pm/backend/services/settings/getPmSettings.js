/**
 * FICHIER : modules/pm/backend/services/settings/getPmSettings.js
 * RÔLE : Lit les paramètres PM de l'entreprise.
 */

const COLLECTION = 'pm_settings';

async function getPmSettings(db, entrepriseId) {
  const doc = await db.collection(COLLECTION).findOne({ entrepriseId: String(entrepriseId) });
  return {
    defaultBoutiqueId: doc?.defaultBoutiqueId || null,
    inboxPollEnabled: doc?.inboxPollEnabled !== false,
    updatedAt: doc?.updatedAt || null
  };
}

module.exports = getPmSettings;
