/**
 * FICHIER : modules/gderpi/backend/integrations/pm-bridge/notifyPmFromDevis.js
 * RÔLE : Notifie le module PM après changement devis (compatibilité optionnelle).
 */

async function notifyPmFromDevis(db, entrepriseId, devis) {
  const cardId = devis?.pmCardId;
  if (!cardId) return null;
  try {
    const syncCardFromDevis = require('../../../../pm/backend/services/integrations/gderpi/syncCardFromDevis');
    return syncCardFromDevis(db, entrepriseId, devis, { cardId });
  } catch (_) {
    return null;
  }
}

module.exports = notifyPmFromDevis;
