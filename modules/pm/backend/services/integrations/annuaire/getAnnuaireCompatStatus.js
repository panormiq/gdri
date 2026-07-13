/**
 * FICHIER : modules/pm/backend/services/integrations/annuaire/getAnnuaireCompatStatus.js
 */

const isAnnuaireAvailable = require('./isAnnuaireAvailable');

async function getAnnuaireCompatStatus(db, entrepriseId) {
  const available = isAnnuaireAvailable();
  let linkedCards = 0;
  if (available) {
    linkedCards = await db.collection('pm_cards').countDocuments({
      entrepriseId: String(entrepriseId),
      'annuaire.contactId': { $ne: null }
    });
  }
  return {
    annuaireInstalled: available,
    canResolveContacts: available,
    linkedCards
  };
}

module.exports = getAnnuaireCompatStatus;
